import { Injectable, Logger } from '@nestjs/common';
import { DeviceTokensService } from './device-tokens.service';
import { ExpoPushClient } from './expo-push.client';
import { FcmPushClient } from './fcm-push.client';
import type {
  AiPushInput,
  ChatPushInput,
  ExpoPushMessage,
} from './expo-push.types';
import { classifyPushToken } from './push-token.utils';

const CHAT_CHANNEL_ID = 'chat-messages';

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
export class PushNotificationsService {
  private readonly logger = new Logger(PushNotificationsService.name);

  constructor(
    private readonly deviceTokens: DeviceTokensService,
    private readonly expoPush: ExpoPushClient,
    private readonly fcmPush: FcmPushClient,
  ) {}

  async sendChatMessage(input: ChatPushInput): Promise<void> {
    const body = truncateBody(input.body);
    const title = truncateTitle(input.senderName);
    await this.sendToUser(
      input.recipientId,
      (to) => ({
        to,
        title,
        body,
        data: {
          chatId: input.chatId,
          messageId: input.messageId,
          senderId: input.senderId,
          type: 'chat',
        },
        sound: 'default',
        channelId: CHAT_CHANNEL_ID,
        priority: 'high',
      }),
      (token) => ({
        token,
        title,
        body,
        data: {
          chatId: input.chatId,
          messageId: input.messageId,
          senderId: input.senderId,
          type: 'chat',
        },
      }),
    );
  }

  async sendAiMessage(input: AiPushInput): Promise<void> {
    const body = truncateBody(input.body);
    await this.sendToUser(
      input.recipientId,
      (to) => ({
        to,
        title: 'AI Assistant',
        body,
        data: {
          chatId: input.chatId,
          messageId: input.messageId,
          type: 'ai',
        },
        sound: 'default',
        channelId: CHAT_CHANNEL_ID,
        priority: 'high',
      }),
      (token) => ({
        token,
        title: 'AI Assistant',
        body,
        data: {
          chatId: input.chatId,
          messageId: input.messageId,
          type: 'ai',
        },
      }),
    );
  }

  private async sendToUser(
    recipientId: string,
    buildExpoMessage: (token: string) => ExpoPushMessage,
    buildFcmMessage: (token: string) => Parameters<FcmPushClient['send']>[0][number],
  ): Promise<void> {
    const tokens = await this.deviceTokens.listTokensForUser(recipientId);
    if (!tokens.length) {
      this.logger.debug(`Push skipped — no tokens for user ${recipientId}`);
      return;
    }

    const expoTokens: string[] = [];
    const fcmTokens: string[] = [];
    for (const token of tokens) {
      const kind = classifyPushToken(token);
      if (kind === 'expo') expoTokens.push(token);
      if (kind === 'fcm') fcmTokens.push(token);
    }

    const invalid: string[] = [];

    if (expoTokens.length) {
      const messages = expoTokens.map(buildExpoMessage);
      const expoInvalid = await this.expoPush.send(messages);
      invalid.push(...expoInvalid);
      this.logger.log(
        `Expo push to ${recipientId}: ${messages.length - expoInvalid.length} ok, ${expoInvalid.length} invalid`,
      );
    }

    if (fcmTokens.length) {
      const messages = fcmTokens.map(buildFcmMessage);
      const fcmInvalid = await this.fcmPush.send(messages);
      invalid.push(...fcmInvalid);
      this.logger.log(
        `FCM push to ${recipientId}: ${messages.length - fcmInvalid.length} ok, ${fcmInvalid.length} invalid`,
      );
    }

    if (!expoTokens.length && !fcmTokens.length) {
      this.logger.debug(
        `Push skipped — no recognized tokens for user ${recipientId}`,
      );
    }

    if (invalid.length) {
      await this.deviceTokens.removeInvalidTokens(invalid);
    }
  }
}
