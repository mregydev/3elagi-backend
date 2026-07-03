import { Injectable, Logger } from '@nestjs/common';
import { DeviceTokensService } from '../device-tokens.service';
import { ExpoPushClient } from '../expo-push.client';
import type { ExpoPushMessage } from '../expo-push.types';
import { isValidExpoPushToken } from '../expo-push.tokens';
import type {
  AiPushInput,
  AppointmentReminderPushInput,
  AppointmentRequestPushInput,
  AppointmentStatusPushInput,
  ChatPushInput,
  IncomingVideoCallPushInput,
  PushProvider,
} from '../push.types';

const CHAT_CHANNEL_ID = 'chat-messages';
const VIDEO_CALL_CHANNEL_ID = 'video-calls';
const APPOINTMENT_CHANNEL_ID = 'appointments';

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
export class ExpoPushProvider implements PushProvider {
  readonly id = 'expo' as const;
  private readonly logger = new Logger(ExpoPushProvider.name);

  constructor(
    private readonly deviceTokens: DeviceTokensService,
    private readonly expoPush: ExpoPushClient,
  ) {}

  async sendChatMessage(input: ChatPushInput): Promise<void> {
    const body = truncateBody(input.body);
    const title = truncateTitle(input.senderName);
    await this.sendToUser(input.recipientId, (to) => ({
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
    }));
  }

  async sendAiMessage(input: AiPushInput): Promise<void> {
    const body = truncateBody(input.body);
    await this.sendToUser(input.recipientId, (to) => ({
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
    }));
  }

  async sendIncomingVideoCall(input: IncomingVideoCallPushInput): Promise<void> {
    const callerName = truncateTitle(input.callerName, 48);
    await this.sendToUser(input.recipientId, (to) => ({
      to,
      title: 'Incoming video call',
      body: `${callerName} is calling`,
      data: {
        type: 'incoming_video_call',
        sessionId: input.sessionId,
        callerId: input.callerId,
        callerName: input.callerName,
      },
      sound: 'default',
      channelId: VIDEO_CALL_CHANNEL_ID,
      priority: 'high',
    }));
  }

  async sendAppointmentRequest(input: AppointmentRequestPushInput): Promise<void> {
    const patientName = truncateTitle(input.patientName, 48);
    await this.sendToUser(input.recipientId, (to) => ({
      to,
      title: 'Appointment request',
      body: `${patientName} requested ${input.date} ${input.time}`,
      data: {
        type: 'appointment_request',
        appointmentId: input.appointmentId,
        chatId: input.patientUserId,
      },
      sound: 'default',
      channelId: APPOINTMENT_CHANNEL_ID,
      priority: 'high',
    }));
  }

  async sendAppointmentStatus(input: AppointmentStatusPushInput): Promise<void> {
    const actorName = truncateTitle(input.actorName, 48);
    const verb =
      input.action === 'confirm'
        ? 'confirmed'
        : input.action === 'reject'
          ? 'declined'
          : 'cancelled';
    await this.sendToUser(input.recipientId, (to) => ({
      to,
      title: 'Appointment update',
      body: `${actorName} ${verb} ${input.date} ${input.time}`,
      data: {
        type: 'appointment_status',
        appointmentId: input.appointmentId,
        action: input.action,
      },
      sound: 'default',
      channelId: APPOINTMENT_CHANNEL_ID,
      priority: 'default',
    }));
  }

  async sendAppointmentReminder(input: AppointmentReminderPushInput): Promise<void> {
    const otherParticipantName = truncateTitle(input.otherParticipantName, 48);
    await this.sendToUser(input.recipientId, (to) => ({
      to,
      title: 'Meeting in 5 minutes',
      body: `Your meeting with ${otherParticipantName} is in 5 minutes. Open Appointments to find the room link.`,
      data: {
        type: 'appointment_reminder',
        appointmentId: input.appointmentId,
        sessionId: input.sessionId,
        meetingLink: input.meetingLink,
        otherParticipantName: input.otherParticipantName,
      },
      sound: 'default',
      channelId: APPOINTMENT_CHANNEL_ID,
      priority: 'high',
    }));
  }

  private async sendToUser(
    recipientId: string,
    buildMessage: (token: string) => ExpoPushMessage,
  ): Promise<void> {
    const tokens = await this.deviceTokens.listTokensForUser(recipientId);
    const expoTokens = tokens.filter(isValidExpoPushToken);
    if (!expoTokens.length) {
      this.logger.debug(
        `Expo push skipped — no Expo tokens for user ${recipientId}`,
      );
      return;
    }

    const messages = expoTokens.map(buildMessage);
    const invalid = await this.expoPush.send(messages);
    this.logger.log(
      `Expo push to ${recipientId}: ${messages.length - invalid.length} ok, ${invalid.length} invalid`,
    );

    if (invalid.length) {
      await this.deviceTokens.removeInvalidTokens(invalid);
    }
  }
}
