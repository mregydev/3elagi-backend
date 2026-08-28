import { Injectable, Logger } from '@nestjs/common';
import { buildAppointmentStatusNotification } from '../../notifications/notification-content';
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
  VideoCallCancelledPushInput,
  IntakeExamReminderPushInput,
  PushProvider,
  SystemNotificationPushInput,
} from '../push.types';

const CHAT_CHANNEL_ID = 'chat-messages';
// Must match EXPO_VIDEO_CALL_CHANNEL_ID in the app (constants/expoPush.ts).
const VIDEO_CALL_CHANNEL_ID = 'video-calls-ring';
const APPOINTMENT_CHANNEL_ID = 'appointments';

/**
 * One notification per conversation instead of a stack of them: iOS groups by
 * `threadId`, Android replaces the shown notification with the same `tag`.
 */
function thread(key: string): Pick<ExpoPushMessage, 'threadId' | 'tag'> {
  return { threadId: key, tag: key };
}

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
      ...thread(`chat:${input.chatId}`),
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
      ...thread(`ai:${input.chatId}`),
    }));
  }

  async sendIncomingVideoCall(input: IncomingVideoCallPushInput): Promise<void> {
    const callerName = truncateTitle(input.callerName, 48);
    await this.sendToUser(input.recipientId, (to) => ({
      to,
      // Data-only so Android FCM invokes onMessageReceived even when the app
      // is killed; native code shows CallStyle UI + loops incoming_call.wav.
      data: {
        type: 'incoming_video_call',
        sessionId: input.sessionId,
        callerId: input.callerId,
        callerName: input.callerName,
        title: 'Incoming video call',
        body: `${callerName} is calling`,
      },
      priority: 'high',
      channelId: VIDEO_CALL_CHANNEL_ID,
      interruptionLevel: 'critical',
      ...thread(`call:${input.sessionId}`),
    }));
  }

  async sendVideoCallCancelled(
    input: VideoCallCancelledPushInput,
  ): Promise<void> {
    const callerName = truncateTitle(input.callerName, 48);
    await this.sendToUser(input.recipientId, (to) => ({
      to,
      data: {
        type: 'video_call_cancelled',
        sessionId: input.sessionId,
        title: 'Missed video call',
        body: `${callerName} hung up`,
      },
      priority: 'high',
      channelId: VIDEO_CALL_CHANNEL_ID,
      ...thread(`call:${input.sessionId}`),
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
      ...thread(`appointment:${input.appointmentId}`),
    }));
  }

  async sendAppointmentStatus(input: AppointmentStatusPushInput): Promise<void> {
    const { title, body } = buildAppointmentStatusNotification(input);
    await this.sendToUser(input.recipientId, (to) => ({
      to,
      title,
      body,
      data: {
        type: 'appointment_status',
        appointmentId: input.appointmentId,
        action: input.action,
      },
      sound: 'default',
      channelId: APPOINTMENT_CHANNEL_ID,
      priority: 'default',
      ...thread(`appointment:${input.appointmentId}`),
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
      ...thread(`appointment:${input.appointmentId}`),
    }));
  }

  async sendIntakeExamReminder(input: IntakeExamReminderPushInput): Promise<void> {
    const doctorName = truncateTitle(input.doctorName, 48);
    const examName = truncateTitle(input.examName, 48);
    await this.sendToUser(input.recipientId, (to) => ({
      to,
      title: 'Intake exam due soon',
      body: `Your intake exam "${examName}" from Dr. ${doctorName} is due within 24 hours. Open medical records to complete it.`,
      data: {
        type: 'intake_exam_reminder',
        instanceId: input.instanceId,
        examName: input.examName,
        doctorName: input.doctorName,
        deadlineAt: input.deadlineAt,
      },
      sound: 'default',
      channelId: APPOINTMENT_CHANNEL_ID,
      priority: 'high',
      ...thread(`intake:${input.instanceId}`),
    }));
  }

  async sendSystemNotification(input: SystemNotificationPushInput): Promise<void> {
    await this.sendToUser(input.recipientId, (to) => ({
      to,
      title: truncateTitle(input.title),
      body: truncateBody(input.body),
      data: {
        type: 'system_notification',
        ...(input.data ?? {}),
      },
      sound: 'default',
      channelId: CHAT_CHANNEL_ID,
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
