import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AiConversation } from '../entities/ai-conversation.entity';
import { AiMessage } from '../entities/ai-message.entity';
import { Message } from '../entities/message.entity';
import {
  MessageEmotion,
  type MessageEmotionSource,
  type MessageEmotionType,
} from '../entities/message-emotion.entity';
import { PresenceGateway } from '../presence/presence.gateway';

export interface MessageEmotionView {
  user_id: string;
  emotion: MessageEmotionType;
}

export interface MessageEmotionsPayload {
  message_id: string;
  message_source: MessageEmotionSource;
  emotions: MessageEmotionView[];
}

@Injectable()
export class MessageEmotionsService {
  constructor(
    @InjectRepository(MessageEmotion)
    private readonly emotionRepo: Repository<MessageEmotion>,
    @InjectRepository(Message)
    private readonly messageRepo: Repository<Message>,
    @InjectRepository(AiMessage)
    private readonly aiMessageRepo: Repository<AiMessage>,
    @InjectRepository(AiConversation)
    private readonly aiConversationRepo: Repository<AiConversation>,
    private readonly presenceGateway: PresenceGateway,
  ) {}

  async setEmotion(
    userId: string,
    messageId: string,
    source: MessageEmotionSource,
    emotion: MessageEmotionType,
  ): Promise<MessageEmotionsPayload> {
    this.assertAllowedEmotion(source, emotion);
    await this.assertCanReact(userId, messageId, source);

    const existing = await this.emotionRepo.findOne({
      where: { message_id: messageId, message_source: source, user_id: userId },
    });

    if (existing?.emotion === emotion) {
      await this.emotionRepo.remove(existing);
      const payload = await this.buildPayload(messageId, source);
      await this.broadcastUpdate(messageId, source, payload);
      return payload;
    }

    if (existing) {
      existing.emotion = emotion;
      await this.emotionRepo.save(existing);
    } else {
      await this.emotionRepo.save(
        this.emotionRepo.create({
          message_id: messageId,
          message_source: source,
          user_id: userId,
          emotion,
        }),
      );
    }

    const payload = await this.buildPayload(messageId, source);
    await this.broadcastUpdate(messageId, source, payload);
    return payload;
  }

  async removeEmotion(
    userId: string,
    messageId: string,
    source: MessageEmotionSource,
  ): Promise<MessageEmotionsPayload> {
    await this.assertCanReact(userId, messageId, source);

    const existing = await this.emotionRepo.findOne({
      where: { message_id: messageId, message_source: source, user_id: userId },
    });
    if (existing) await this.emotionRepo.remove(existing);

    const payload = await this.buildPayload(messageId, source);
    await this.broadcastUpdate(messageId, source, payload);
    return payload;
  }

  async getForMessages(
    messageIds: string[],
    source: MessageEmotionSource,
  ): Promise<Record<string, MessageEmotionView[]>> {
    if (!messageIds.length) return {};

    const rows = await this.emotionRepo.find({
      where: {
        message_id: In(messageIds),
        message_source: source,
      },
      order: { created_at: 'ASC' },
    });

    const grouped: Record<string, MessageEmotionView[]> = {};
    for (const row of rows) {
      const list = grouped[row.message_id] ?? [];
      list.push({ user_id: row.user_id, emotion: row.emotion });
      grouped[row.message_id] = list;
    }
    return grouped;
  }

  attachToRows<T extends { id: string }>(
    rows: T[],
    grouped: Record<string, MessageEmotionView[]>,
  ): Array<T & { emotions: MessageEmotionView[] }> {
    return rows.map((row) => ({
      ...row,
      emotions: grouped[row.id] ?? [],
    }));
  }

  private async buildPayload(
    messageId: string,
    source: MessageEmotionSource,
  ): Promise<MessageEmotionsPayload> {
    const grouped = await this.getForMessages([messageId], source);
    return {
      message_id: messageId,
      message_source: source,
      emotions: grouped[messageId] ?? [],
    };
  }

  private assertAllowedEmotion(
    source: MessageEmotionSource,
    emotion: MessageEmotionType,
  ): void {
    if (source === 'ai' && emotion !== 'like' && emotion !== 'dislike') {
      throw new BadRequestException('AI messages only support like and dislike');
    }
  }

  private async assertCanReact(
    userId: string,
    messageId: string,
    source: MessageEmotionSource,
  ): Promise<void> {
    if (source === 'chat') {
      const message = await this.messageRepo.findOne({ where: { id: messageId } });
      if (!message) throw new NotFoundException('Message not found');
      if (message.creator !== userId && message.recipient !== userId) {
        throw new ForbiddenException('You cannot react to this message');
      }
      return;
    }

    const aiMessage = await this.aiMessageRepo.findOne({
      where: { id: messageId },
    });
    if (!aiMessage) throw new NotFoundException('Message not found');

    const conversation = await this.aiConversationRepo.findOne({
      where: { id: aiMessage.conversation_id, user_id: userId },
    });
    if (!conversation) {
      throw new ForbiddenException('You cannot react to this message');
    }
  }

  private async broadcastUpdate(
    messageId: string,
    source: MessageEmotionSource,
    payload: MessageEmotionsPayload,
  ): Promise<void> {
    const event = { ...payload };

    if (source === 'chat') {
      const message = await this.messageRepo.findOne({ where: { id: messageId } });
      if (!message) return;
      this.presenceGateway.emitToUser(message.creator, 'message:emotion:updated', event);
      this.presenceGateway.emitToUser(message.recipient, 'message:emotion:updated', event);
      return;
    }

    const aiMessage = await this.aiMessageRepo.findOne({ where: { id: messageId } });
    if (!aiMessage) return;
    const conversation = await this.aiConversationRepo.findOne({
      where: { id: aiMessage.conversation_id },
    });
    if (!conversation) return;
    this.presenceGateway.emitToUser(conversation.user_id, 'message:emotion:updated', event);
  }
}
