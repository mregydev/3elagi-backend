import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiConversation } from '../entities/ai-conversation.entity';
import { AiMessage } from '../entities/ai-message.entity';
import { AiUsageLog } from '../entities/ai-usage-log.entity';
import { UserRole } from '../entities/user.entity';
import { AiCacheService } from './ai-cache.service';
import { AiPromptService } from './ai-prompt.service';
import type { RetrievedChunk } from './ai-prompt.service';
import { VectorSearchService } from './vector-search.service';
import { Inject } from '@nestjs/common';
import type { LlmMessage, LlmProvider } from './llm/llm.types';
import { LLM_PROVIDER } from './llm/llm.tokens';

export interface AuthUser {
  id: string;
  role: string;
}

export interface ChatResult {
  conversationId: string;
  messageId: string;
  content: string;
  cacheHit: boolean;
}

export interface StreamEvent {
  type: 'token' | 'done' | 'error';
  content?: string;
  conversationId?: string;
  messageId?: string;
  error?: string;
}

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 20;

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly rateBuckets = new Map<string, number[]>();

  constructor(
    @Inject(LLM_PROVIDER) private readonly llm: LlmProvider,
    private readonly prompt: AiPromptService,
    private readonly vectorSearch: VectorSearchService,
    private readonly cache: AiCacheService,
    @InjectRepository(AiConversation)
    private readonly conversationRepo: Repository<AiConversation>,
    @InjectRepository(AiMessage)
    private readonly messageRepo: Repository<AiMessage>,
    @InjectRepository(AiUsageLog)
    private readonly usageRepo: Repository<AiUsageLog>,
  ) {}

  async listHistory(userId: string) {
    const conversations = await this.conversationRepo.find({
      where: { user_id: userId },
      order: { updated_at: 'DESC' },
      take: 50,
    });
    const withMessages = await Promise.all(
      conversations.map(async (c) => {
        const messages = await this.messageRepo.find({
          where: { conversation_id: c.id },
          order: { created_at: 'ASC' },
        });
        return {
          id: c.id,
          title: c.title,
          patientContextId: c.patient_context_id,
          createdAt: c.created_at.toISOString(),
          updatedAt: c.updated_at.toISOString(),
          messages: messages.map((m) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            createdAt: m.created_at.toISOString(),
          })),
        };
      }),
    );
    return withMessages;
  }

  async deleteConversation(userId: string, conversationId: string): Promise<void> {
    const conversation = await this.conversationRepo.findOne({
      where: { id: conversationId, user_id: userId },
    });
    if (!conversation) throw new NotFoundException('Conversation not found');
    await this.conversationRepo.remove(conversation);
  }

  async chat(
    user: AuthUser,
    message: string,
    conversationId?: string,
    patientUserId?: string,
  ): Promise<ChatResult> {
    this.assertRateLimit(user.id);
    const started = Date.now();
    const contextPatientId = this.resolveContextPatientId(user, patientUserId);

    const { conversation, history } = await this.loadConversation(
      user.id,
      conversationId,
      message,
      contextPatientId,
    );

    const retrievalKey = this.cache.buildKey(
      user.id,
      user.role,
      message,
      'retrieval',
    );
    let chunks =
      await this.cache.get<RetrievedChunk[]>(retrievalKey);

    if (!chunks) {
      const search = await this.vectorSearch.search(message, {
        userId: user.id,
        userRole: user.role,
        patientUserId: contextPatientId ?? undefined,
      });
      chunks = search.chunks;
      await this.cache.set(retrievalKey, chunks);
    }

    const responseKey = this.cache.buildKey(
      user.id,
      user.role,
      message,
      'response',
    );
    const cached = await this.cache.get<string>(responseKey);
    let content: string;
    let cacheHit = false;

    if (cached) {
      content = cached;
      cacheHit = true;
    } else {
      const llmMessages = await this.prompt.buildMessages(
        message,
        chunks,
        history,
      );
      content = await this.llm.chat(llmMessages);
      await this.cache.set(responseKey, content);
    }

    await this.messageRepo.save(
      this.messageRepo.create({
        conversation_id: conversation.id,
        role: 'user',
        content: message,
      }),
    );
    const assistantMessage = await this.messageRepo.save(
      this.messageRepo.create({
        conversation_id: conversation.id,
        role: 'assistant',
        content,
      }),
    );

    conversation.updated_at = new Date();
    await this.conversationRepo.save(conversation);

    await this.logUsage({
      userId: user.id,
      userRole: user.role,
      conversationId: conversation.id,
      question: message,
      cacheHit,
      latencyMs: Date.now() - started,
    });

    return {
      conversationId: conversation.id,
      messageId: assistantMessage.id,
      content,
      cacheHit,
    };
  }

  async *streamChat(
    user: AuthUser,
    message: string,
    conversationId?: string,
    patientUserId?: string,
  ): AsyncGenerator<StreamEvent> {
    this.assertRateLimit(user.id);
    const started = Date.now();
    const contextPatientId = this.resolveContextPatientId(user, patientUserId);

    try {
      const { conversation, history } = await this.loadConversation(
        user.id,
        conversationId,
        message,
        contextPatientId,
      );

      await this.messageRepo.save(
        this.messageRepo.create({
          conversation_id: conversation.id,
          role: 'user',
          content: message,
        }),
      );

      const retrievalKey = this.cache.buildKey(
        user.id,
        user.role,
        message,
        'retrieval',
      );
      let chunks =
        await this.cache.get<RetrievedChunk[]>(retrievalKey);

      if (!chunks) {
        const search = await this.vectorSearch.search(message, {
          userId: user.id,
          userRole: user.role,
          patientUserId: contextPatientId ?? undefined,
        });
        chunks = search.chunks;
        await this.cache.set(retrievalKey, chunks);
      }

      const responseKey = this.cache.buildKey(
        user.id,
        user.role,
        message,
        'response',
      );
      const cached = await this.cache.get<string>(responseKey);

      let fullContent = '';
      let cacheHit = false;

      if (cached) {
        fullContent = cached;
        cacheHit = true;
        yield { type: 'token', content: cached };
      } else {
        const llmMessages = await this.prompt.buildMessages(
          message,
          chunks,
          history,
        );
        for await (const token of this.llm.streamChat(llmMessages)) {
          fullContent += token;
          yield { type: 'token', content: token };
        }
        await this.cache.set(responseKey, fullContent);
      }

      const assistantMessage = await this.messageRepo.save(
        this.messageRepo.create({
          conversation_id: conversation.id,
          role: 'assistant',
          content: fullContent,
        }),
      );

      conversation.updated_at = new Date();
      await this.conversationRepo.save(conversation);

      await this.logUsage({
        userId: user.id,
        userRole: user.role,
        conversationId: conversation.id,
        question: message,
        cacheHit,
        latencyMs: Date.now() - started,
      });

      yield {
        type: 'done',
        conversationId: conversation.id,
        messageId: assistantMessage.id,
      };
    } catch (err) {
      const error =
        err instanceof Error ? err.message : 'AI request failed';
      this.logger.error(error, err instanceof Error ? err.stack : undefined);
      yield { type: 'error', error };
    }
  }

  private resolveContextPatientId(
    user: AuthUser,
    patientUserId?: string,
  ): string | null {
    if (user.role === UserRole.PATIENT) {
      if (patientUserId && patientUserId !== user.id) {
        throw new ForbiddenException('Patients can only query their own records');
      }
      return user.id;
    }
    return patientUserId ?? null;
  }

  private async loadConversation(
    userId: string,
    conversationId: string | undefined,
    firstMessage: string,
    patientContextId: string | null,
  ): Promise<{ conversation: AiConversation; history: LlmMessage[] }> {
    let conversation: AiConversation | null = null;
    if (conversationId) {
      conversation = await this.conversationRepo.findOne({
        where: { id: conversationId, user_id: userId },
      });
      if (!conversation) throw new NotFoundException('Conversation not found');
    } else {
      conversation = await this.conversationRepo.save(
        this.conversationRepo.create({
          user_id: userId,
          title: firstMessage.slice(0, 80) || 'New chat',
          patient_context_id: patientContextId,
        }),
      );
    }

    const prior = await this.messageRepo.find({
      where: { conversation_id: conversation.id },
      order: { created_at: 'ASC' },
      take: 20,
    });

    const history: LlmMessage[] = prior.map((m) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content,
    }));

    return { conversation, history };
  }

  private assertRateLimit(userId: string): void {
    const now = Date.now();
    const windowStart = now - RATE_LIMIT_WINDOW_MS;
    const hits = (this.rateBuckets.get(userId) ?? []).filter(
      (t) => t > windowStart,
    );
    if (hits.length >= RATE_LIMIT_MAX) {
      throw new HttpException(
        'Too many AI requests. Please wait a moment and try again.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    hits.push(now);
    this.rateBuckets.set(userId, hits);
  }

  private async logUsage(input: {
    userId: string;
    userRole: string;
    conversationId: string;
    question: string;
    cacheHit: boolean;
    latencyMs: number;
  }): Promise<void> {
    await this.usageRepo.save(
      this.usageRepo.create({
        user_id: input.userId,
        user_role: input.userRole,
        conversation_id: input.conversationId,
        question: input.question,
        cache_hit: input.cacheHit,
        latency_ms: input.latencyMs,
        tokens_estimated: Math.ceil(input.question.length / 4),
      }),
    );
  }
}
