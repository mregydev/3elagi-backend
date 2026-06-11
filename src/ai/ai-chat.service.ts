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
import { AiContextBuilderService } from './ai-context-builder.service';
import { AiPromptService } from './ai-prompt.service';
import { AiStreamService } from './ai-stream.service';
import {
  AI_RATE_LIMIT_CODE,
  AI_RATE_LIMIT_MESSAGE_EN,
} from './ai.constants';
import type { AiContextUser } from './context/ai-context.types';
import type { LlmMessage } from './llm/llm.types';

export interface AuthUser {
  id: string;
  role: string;
}

export interface StreamEvent {
  type: 'token' | 'done' | 'error' | 'ack';
  content?: string;
  conversationId?: string;
  messageId?: string;
  userMessageId?: string;
  error?: string;
  code?: string;
  cacheHit?: boolean;
}

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 20;

@Injectable()
export class AiChatService {
  private readonly logger = new Logger(AiChatService.name);
  private readonly rateBuckets = new Map<string, number[]>();

  constructor(
    private readonly contextBuilder: AiContextBuilderService,
    private readonly prompt: AiPromptService,
    private readonly stream: AiStreamService,
    private readonly cache: AiCacheService,
    @InjectRepository(AiConversation)
    private readonly conversationRepo: Repository<AiConversation>,
    @InjectRepository(AiMessage)
    private readonly messageRepo: Repository<AiMessage>,
    @InjectRepository(AiUsageLog)
    private readonly usageRepo: Repository<AiUsageLog>,
  ) {}

  resolvePatientScope(user: AuthUser, patientUserId?: string): string | null {
    if (user.role === UserRole.PATIENT) {
      if (patientUserId && patientUserId !== user.id) {
        throw new ForbiddenException('Patients can only query their own records');
      }
      return user.id;
    }
    return patientUserId ?? null;
  }

  patientRoomId(patientScope: string | null, user: AuthUser): string {
    return patientScope ?? user.id;
  }

  async listHistory(userId: string) {
    const conversations = await this.conversationRepo.find({
      where: { user_id: userId },
      order: { updated_at: 'DESC' },
      take: 50,
    });

    return Promise.all(
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
  }

  async createConversation(
    user: AuthUser,
    title?: string,
    patientUserId?: string,
  ) {
    const patientScope = this.resolvePatientScope(user, patientUserId);
    const conversation = await this.conversationRepo.save(
      this.conversationRepo.create({
        user_id: user.id,
        title: title?.slice(0, 80) || 'New chat',
        patient_context_id: patientScope,
      }),
    );
    return {
      id: conversation.id,
      title: conversation.title,
      patientContextId: conversation.patient_context_id,
      createdAt: conversation.created_at.toISOString(),
      updatedAt: conversation.updated_at.toISOString(),
      messages: [],
    };
  }

  async deleteConversation(userId: string, conversationId: string): Promise<void> {
    const conversation = await this.conversationRepo.findOne({
      where: { id: conversationId, user_id: userId },
    });
    if (!conversation) throw new NotFoundException('Conversation not found');
    await this.conversationRepo.remove(conversation);
  }

  async *streamMessage(
    user: AuthUser,
    message: string,
    conversationId?: string,
    patientUserId?: string,
  ): AsyncGenerator<StreamEvent> {
    try {
      this.assertRateLimit(user.id);
      const started = Date.now();
      const patientScope = this.resolvePatientScope(user, patientUserId);
      const contextUser: AiContextUser = {
        id: user.id,
        role: user.role,
        patientContextId: patientScope,
      };

      let conversation: AiConversation;
      const loaded = await this.loadConversation(
        user.id,
        conversationId,
        message,
        patientScope,
      );
      conversation = loaded.conversation;
      const { history } = loaded;

      const userRow = await this.messageRepo.save(
        this.messageRepo.create({
          conversation_id: conversation.id,
          role: 'user',
          content: message,
        }),
      );

      yield {
        type: 'ack',
        conversationId: conversation.id,
        userMessageId: userRow.id,
      };

      const built = await this.contextBuilder.build(contextUser, message);

      if (built.urgent && built.urgentMessage) {
        const assistantMessage = await this.messageRepo.save(
          this.messageRepo.create({
            conversation_id: conversation.id,
            role: 'assistant',
            content: built.urgentMessage,
          }),
        );
        conversation.updated_at = new Date();
        await this.conversationRepo.save(conversation);
        yield { type: 'token', content: built.urgentMessage };
        yield {
          type: 'done',
          conversationId: conversation.id,
          messageId: assistantMessage.id,
          cacheHit: false,
        };
        return;
      }

      const cachePatientId = patientScope ?? user.id;
      const answerKey = this.cache.buildAnswerKey(
        cachePatientId,
        message,
        built.contextVersion,
        built.promptVersion,
      );

      const cached = await this.cache.get<string>(answerKey);
      let fullContent = '';
      let cacheHit = false;

      if (cached) {
        fullContent = cached;
        cacheHit = true;
        yield { type: 'token', content: cached };
      } else {
        const llmMessages = await this.prompt.buildMessages(
          message,
          built.contextText,
          built.intent,
          history,
        );
        for await (const token of this.stream.streamTokens(llmMessages)) {
          fullContent += token;
          yield { type: 'token', content: token };
        }
        await this.cache.set(answerKey, fullContent);
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
        cacheHit,
      };
    } catch (err) {
      if (
        err instanceof HttpException &&
        err.getStatus() === HttpStatus.TOO_MANY_REQUESTS
      ) {
        yield {
          type: 'error',
          error: AI_RATE_LIMIT_MESSAGE_EN,
          code: AI_RATE_LIMIT_CODE,
        };
        return;
      }

      const raw =
        err instanceof Error ? err.message : 'AI request failed';
      const error = raw.includes('API key')
        ? 'AI service is not configured correctly. Please contact support.'
        : raw;
      this.logger.error(raw, err instanceof Error ? err.stack : undefined);
      yield { type: 'error', error };
    }
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
        AI_RATE_LIMIT_MESSAGE_EN,
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
