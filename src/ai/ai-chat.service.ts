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
import { User, UserRole } from '../entities/user.entity';
import { AiCacheService } from './ai-cache.service';
import { AiContextBuilderService } from './ai-context-builder.service';
import { AiPromptService } from './ai-prompt.service';
import { AiLinkValidatorService } from './ai-link-validator.service';
import { AiResponseService } from './ai-response.service';
import { UploadsService } from '../uploads/uploads.service';
import { MessageEmotionsService } from '../message-emotions/message-emotions.service';
import { PointsService } from '../points/points.service';
import { PushNotificationsService } from '../push-notifications/push-notifications.service';
import { AiStreamService } from './ai-stream.service';
import {
  AI_RATE_LIMIT_CODE,
  AI_RATE_LIMIT_MESSAGE_EN,
} from './ai.constants';
import type { AiContextUser } from './context/ai-context.types';
import type { LlmMessage, LlmMessageAttachment } from './llm/llm.types';
import {
  resolvePreferredLocale,
  resolveReplyLocale,
  userMessageDisplayContent,
} from './utils/ai-locale';
import {
  AI_HISTORY_MESSAGE_LIMIT,
  hydrateHistoryForLlm,
} from './utils/ai-history-hydration';

export interface AiMessageAttachmentMeta {
  url?: string;
  mimeType?: string;
  fileName?: string;
}

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
  finalContent?: string;
}

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 20;
/** Set false to allow AI messages without deducting message points. */
const AI_POINTS_DEDUCTION_ENABLED = false;
const AI_MESSAGE_POINT_COST = 1;

@Injectable()
export class AiChatService {
  private readonly logger = new Logger(AiChatService.name);
  private readonly rateBuckets = new Map<string, number[]>();

  constructor(
    private readonly contextBuilder: AiContextBuilderService,
    private readonly prompt: AiPromptService,
    private readonly stream: AiStreamService,
    private readonly response: AiResponseService,
    private readonly linkValidator: AiLinkValidatorService,
    private readonly messageEmotions: MessageEmotionsService,
    private readonly pointsService: PointsService,
    private readonly cache: AiCacheService,
    private readonly uploads: UploadsService,
    private readonly pushNotifications: PushNotificationsService,
    @InjectRepository(AiConversation)
    private readonly conversationRepo: Repository<AiConversation>,
    @InjectRepository(AiMessage)
    private readonly messageRepo: Repository<AiMessage>,
    @InjectRepository(AiUsageLog)
    private readonly usageRepo: Repository<AiUsageLog>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
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
        const grouped = await this.messageEmotions.getForMessages(
          messages.map((m) => m.id),
          'ai',
        );
        return {
          id: c.id,
          title: c.title,
          patientContextId: c.patient_context_id,
          createdAt: c.created_at.toISOString(),
          updatedAt: c.updated_at.toISOString(),
          messages: messages.map((m) => ({
            id: m.id,
            role: m.role,
            content:
              m.role === 'user'
                ? userMessageDisplayContent(
                    m.content,
                    Boolean(m.attachment_url || m.attachment_file_name),
                  )
                : m.content,
            createdAt: m.created_at.toISOString(),
            emotions: grouped[m.id] ?? [],
            fileName: m.attachment_file_name ?? undefined,
            imageUrl:
              m.attachment_url &&
              m.attachment_mime_type?.startsWith('image/')
                ? m.attachment_url
                : undefined,
            attachmentUrl: m.attachment_url ?? undefined,
            attachmentMimeType: m.attachment_mime_type ?? undefined,
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
    attachment?: LlmMessageAttachment,
    attachmentMeta?: AiMessageAttachmentMeta,
  ): AsyncGenerator<StreamEvent> {
    try {
      this.assertRateLimit(user.id);
      if (AI_POINTS_DEDUCTION_ENABLED) {
        await this.pointsService.deductForMessage(user.id, AI_MESSAGE_POINT_COST);
      }
      const started = Date.now();
      const patientScope = this.resolvePatientScope(user, patientUserId);
      const dbUser = await this.userRepo.findOne({
        where: { id: user.id },
        select: ['id', 'preferred_locale'],
      });
      const preferredLocale = resolvePreferredLocale(dbUser?.preferred_locale);
      // Answer in the language of this question; fall back to profile language.
      const replyLocale = resolveReplyLocale(message, preferredLocale);
      const contextUser: AiContextUser = {
        id: user.id,
        role: user.role,
        patientContextId: patientScope,
        preferredLocale: replyLocale,
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
          content: userMessageDisplayContent(
            message,
            Boolean(attachmentMeta?.url || attachmentMeta?.fileName),
          ),
          attachment_url: attachmentMeta?.url ?? null,
          attachment_mime_type: attachmentMeta?.mimeType ?? null,
          attachment_file_name: attachmentMeta?.fileName ?? null,
        }),
      );

      yield {
        type: 'ack',
        conversationId: conversation.id,
        userMessageId: userRow.id,
      };

      const built = await this.contextBuilder.build(contextUser, message);

      if (built.urgent && built.urgentMessage) {
        const urgentText = await this.finalizeAnswer(
          built.urgentMessage,
          built.links,
          contextUser,
        );
        const assistantMessage = await this.messageRepo.save(
          this.messageRepo.create({
            conversation_id: conversation.id,
            role: 'assistant',
            content: urgentText,
          }),
        );
        conversation.updated_at = new Date();
        await this.conversationRepo.save(conversation);
        this.notifyAssistantPush(
          user.id,
          conversation.id,
          assistantMessage.id,
          urgentText,
        );
        yield { type: 'token', content: urgentText };
        yield {
          type: 'done',
          conversationId: conversation.id,
          messageId: assistantMessage.id,
          cacheHit: false,
          finalContent: urgentText,
        };
        return;
      }

      const cachePatientId = patientScope ?? user.id;
      const answerKey = this.cache.buildAnswerKey(
        cachePatientId,
        message,
        built.contextVersion,
        built.promptVersion,
        user.role,
        replyLocale,
      );

      // Answers that depend on an uploaded file or prior thread context must not be cached.
      const cached =
        attachment || history.length > 0
          ? null
          : await this.cache.get<string>(answerKey);
      let fullContent = '';
      let cacheHit = false;

      if (cached) {
        fullContent = await this.finalizeAnswer(cached, built.links, contextUser);
        cacheHit = true;
        yield { type: 'token', content: fullContent };
      } else {
        const llmMessages = await this.prompt.buildMessages(
          message,
          built.contextText,
          built.intent,
          history,
          user.role,
          replyLocale,
          Boolean(attachment),
        );
        if (attachment?.data) {
          // Attach the file to the latest user turn.
          for (let i = llmMessages.length - 1; i >= 0; i -= 1) {
            if (llmMessages[i].role === 'user') {
              llmMessages[i] = { ...llmMessages[i], attachment };
              break;
            }
          }
        }
        for await (const token of this.stream.streamTokens(llmMessages)) {
          fullContent += token;
          yield { type: 'token', content: token };
        }
        if (!attachment && history.length === 0) {
          await this.cache.set(answerKey, fullContent);
        }
      }

      fullContent = await this.finalizeAnswer(fullContent, built.links, contextUser);

      const assistantMessage = await this.messageRepo.save(
        this.messageRepo.create({
          conversation_id: conversation.id,
          role: 'assistant',
          content: fullContent,
        }),
      );

      conversation.updated_at = new Date();
      await this.conversationRepo.save(conversation);

      this.notifyAssistantPush(
        user.id,
        conversation.id,
        assistantMessage.id,
        fullContent,
      );

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
        finalContent: fullContent,
      };
    } catch (err) {
      if (err instanceof ForbiddenException) {
        yield {
          type: 'error',
          error: err.message,
          code: 'insufficient_points',
        };
        return;
      }

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

  private notifyAssistantPush(
    recipientId: string,
    conversationId: string,
    messageId: string,
    content: string,
  ): void {
    // Remote AI push stays disabled; still persist an in-app inbox row.
    void this.pushNotifications.recordAiMessage({
      recipientId,
      chatId: conversationId,
      messageId,
      body: content,
    });
  }

  private async finalizeAnswer(
    content: string,
    links: import('./ai-response.service').AiLinkEntry[],
    user: AiContextUser,
  ): Promise<string> {
    const branded = this.response.sanitizeBranding(content);
    const enriched = this.response.enrichWithLinks(branded, links);
    return this.linkValidator.sanitizeResponse(enriched, links, user);
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

    const priorDesc = await this.messageRepo.find({
      where: { conversation_id: conversation.id },
      order: { created_at: 'DESC' },
      take: AI_HISTORY_MESSAGE_LIMIT,
    });
    const prior = priorDesc.reverse();

    const history = await hydrateHistoryForLlm(prior, this.uploads);

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
