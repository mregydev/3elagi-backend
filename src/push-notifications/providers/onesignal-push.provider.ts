import { Injectable, Logger } from '@nestjs/common';
import { OneSignalPushClient } from '../onesignal-push.client';
import type {
  AiPushInput,
  ChatPushInput,
  PushProvider,
} from '../push.types';

function truncateTitle(text: string, max = 64): string {
  const trimmed = text?.trim() ?? '';
  if (!trimmed) return 'New message';
  return trimmed.length > max ? `${trimmed.slice(0, max - 3)}...` : trimmed;
}

function truncateBody(text: string, max = 200): string {
  const trimmed = text?.trim() ?? '';
  if (!trimmed) return 'New message';
  return trimmed.length > max ? `${trimmed.slice(0, max - 3)}...` : trimmed;
}

@Injectable()
export class OneSignalPushProvider implements PushProvider {
  readonly id = 'onesignal' as const;
  private readonly logger = new Logger(OneSignalPushProvider.name);

  constructor(private readonly oneSignal: OneSignalPushClient) {}

  async sendChatMessage(input: ChatPushInput): Promise<void> {
    const body = truncateBody(input.body);
    const title = truncateTitle(input.senderName);
    await this.sendToUser(input.recipientId, title, body, {
      chatId: input.chatId,
      messageId: input.messageId,
      senderId: input.senderId,
      type: 'chat',
    });
  }

  async sendAiMessage(input: AiPushInput): Promise<void> {
    const body = truncateBody(input.body);
    await this.sendToUser(input.recipientId, 'AI Assistant', body, {
      chatId: input.chatId,
      messageId: input.messageId,
      type: 'ai',
    });
  }

  private async sendToUser(
    recipientId: string,
    title: string,
    body: string,
    data: Record<string, string>,
  ): Promise<void> {
    if (!recipientId.trim()) {
      this.logger.debug('OneSignal push skipped — empty recipient id');
      return;
    }

    await this.oneSignal.send({
      externalUserIds: [recipientId],
      title,
      body,
      data,
    });
  }
}
