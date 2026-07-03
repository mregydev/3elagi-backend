import { Injectable, Logger } from '@nestjs/common';
import { OneSignalPushClient } from '../onesignal-push.client';
import type {
  AiPushInput,
  AppointmentReminderPushInput,
  AppointmentRequestPushInput,
  AppointmentStatusPushInput,
  ChatPushInput,
  IncomingVideoCallPushInput,
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

  async sendIncomingVideoCall(input: IncomingVideoCallPushInput): Promise<void> {
    const callerName = truncateTitle(input.callerName, 48);
    await this.sendToUser(
      input.recipientId,
      'Incoming video call',
      `${callerName} is calling`,
      {
        type: 'incoming_video_call',
        sessionId: input.sessionId,
        callerId: input.callerId,
        callerName: input.callerName,
      },
    );
  }

  async sendAppointmentRequest(input: AppointmentRequestPushInput): Promise<void> {
    const patientName = truncateTitle(input.patientName, 48);
    await this.sendToUser(
      input.recipientId,
      'Appointment request',
      `${patientName} requested ${input.date} ${input.time}`,
      {
        type: 'appointment_request',
        appointmentId: input.appointmentId,
        chatId: input.patientUserId,
      },
    );
  }

  async sendAppointmentStatus(input: AppointmentStatusPushInput): Promise<void> {
    const actorName = truncateTitle(input.actorName, 48);
    const verb =
      input.action === 'confirm'
        ? 'confirmed'
        : input.action === 'reject'
          ? 'declined'
          : 'cancelled';
    await this.sendToUser(
      input.recipientId,
      'Appointment update',
      `${actorName} ${verb} ${input.date} ${input.time}`,
      {
        type: 'appointment_status',
        appointmentId: input.appointmentId,
        action: input.action,
      },
    );
  }

  async sendAppointmentReminder(input: AppointmentReminderPushInput): Promise<void> {
    await this.sendToUser(
      input.recipientId,
      'Appointment starting now',
      `Your meeting at ${input.when} is ready. Tap to join.`,
      {
        type: 'appointment_reminder',
        appointmentId: input.appointmentId,
        sessionId: input.sessionId,
        meetingLink: input.meetingLink,
      },
    );
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
