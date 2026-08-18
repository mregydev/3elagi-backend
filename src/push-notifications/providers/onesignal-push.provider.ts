import { Injectable, Logger } from '@nestjs/common';
import { OneSignalPushClient } from '../onesignal-push.client';
import { APPOINTMENT_STATUS_VERB } from '../push.types';
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
    await this.sendToUser(input.recipientId, '', '', {
      type: 'incoming_video_call',
      sessionId: input.sessionId,
      callerId: input.callerId,
      callerName: input.callerName,
      title: 'Incoming video call',
      body: `${callerName} is calling`,
    });
  }

  async sendVideoCallCancelled(
    input: VideoCallCancelledPushInput,
  ): Promise<void> {
    const callerName = truncateTitle(input.callerName, 48);
    await this.sendToUser(input.recipientId, '', '', {
      type: 'video_call_cancelled',
      sessionId: input.sessionId,
      title: 'Missed video call',
      body: `${callerName} hung up`,
    });
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
    const verb = APPOINTMENT_STATUS_VERB[input.action];
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
    const otherParticipantName = truncateTitle(input.otherParticipantName, 48);
    await this.sendToUser(
      input.recipientId,
      'Meeting in 5 minutes',
      `Your meeting with ${otherParticipantName} is in 5 minutes. Open Appointments to find the room link.`,
      {
        type: 'appointment_reminder',
        appointmentId: input.appointmentId,
        sessionId: input.sessionId,
        meetingLink: input.meetingLink,
        otherParticipantName: input.otherParticipantName,
      },
    );
  }

  async sendIntakeExamReminder(input: IntakeExamReminderPushInput): Promise<void> {
    const doctorName = truncateTitle(input.doctorName, 48);
    const examName = truncateTitle(input.examName, 48);
    await this.sendToUser(
      input.recipientId,
      'Intake exam due soon',
      `Your intake exam "${examName}" from Dr. ${doctorName} is due within 24 hours. Open medical records to complete it.`,
      {
        type: 'intake_exam_reminder',
        instanceId: input.instanceId,
        examName: input.examName,
        doctorName: input.doctorName,
        deadlineAt: input.deadlineAt,
      },
    );
  }

  async sendSystemNotification(input: SystemNotificationPushInput): Promise<void> {
    await this.sendToUser(
      input.recipientId,
      truncateTitle(input.title),
      truncateBody(input.body),
      {
        type: 'system_notification',
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
