import type {
  AiPushInput,
  AppointmentReminderPushInput,
  AppointmentRequestPushInput,
  AppointmentStatusPushInput,
  ChatPushInput,
  IncomingVideoCallPushInput,
  IntakeExamReminderPushInput,
  PushNotificationType,
  SystemNotificationPushInput,
} from '../push-notifications/push.types';
import { APPOINTMENT_STATUS_VERB } from '../push-notifications/push.types';

export type InAppNotificationDraft = {
  userId: string;
  type: PushNotificationType;
  title: string;
  body: string;
  data: Record<string, string>;
};

function truncateTitle(text: string, max = 64): string {
  const trimmed = text?.trim() ?? '';
  if (!trimmed) return 'Notification';
  return trimmed.length > max ? `${trimmed.slice(0, max - 3)}...` : trimmed;
}

function truncateBody(text: string, max = 200): string {
  const trimmed = text?.trim() ?? '';
  if (!trimmed) return '';
  return trimmed.length > max ? `${trimmed.slice(0, max - 3)}...` : trimmed;
}

export function draftFromChat(input: ChatPushInput): InAppNotificationDraft {
  return {
    userId: input.recipientId,
    type: 'chat',
    title: truncateTitle(input.senderName),
    body: truncateBody(input.body) || 'New message',
    data: {
      type: 'chat',
      chatId: input.chatId,
      messageId: input.messageId,
      senderId: input.senderId,
    },
  };
}

export function draftFromAi(input: AiPushInput): InAppNotificationDraft {
  return {
    userId: input.recipientId,
    type: 'ai',
    title: 'AI Assistant',
    body: truncateBody(input.body) || 'New AI reply',
    data: {
      type: 'ai',
      chatId: input.chatId,
      messageId: input.messageId,
    },
  };
}

export function draftFromIncomingVideoCall(
  input: IncomingVideoCallPushInput,
): InAppNotificationDraft {
  const callerName = truncateTitle(input.callerName, 48);
  return {
    userId: input.recipientId,
    type: 'incoming_video_call',
    title: 'Incoming video call',
    body: `${callerName} is calling`,
    data: {
      type: 'incoming_video_call',
      sessionId: input.sessionId,
      callerId: input.callerId,
      callerName: input.callerName,
    },
  };
}

export function draftFromAppointmentRequest(
  input: AppointmentRequestPushInput,
): InAppNotificationDraft {
  const patientName = truncateTitle(input.patientName, 48);
  return {
    userId: input.recipientId,
    type: 'appointment_request',
    title: 'Appointment request',
    body: `${patientName} requested ${input.date} ${input.time}`,
    data: {
      type: 'appointment_request',
      appointmentId: input.appointmentId,
      chatId: input.patientUserId,
    },
  };
}

export function draftFromAppointmentStatus(
  input: AppointmentStatusPushInput,
): InAppNotificationDraft {
  const { title, body } = buildAppointmentStatusNotification(input);
  return {
    userId: input.recipientId,
    type: 'appointment_status',
    title,
    body,
    data: {
      type: 'appointment_status',
      appointmentId: input.appointmentId,
      action: input.action,
    },
  };
}

function formatProposedSlot(date?: string, time?: string): string {
  if (!date) return '';
  const clock = time?.trim() ? time.slice(0, 5) : '';
  return clock ? `${date} ${clock}` : date;
}

/** Shared copy for in-app rows and device push for appointment status changes. */
export function buildAppointmentStatusNotification(
  input: AppointmentStatusPushInput,
): { title: string; body: string } {
  const actorName = truncateTitle(input.actorName, 48);
  const slot = `${input.date} ${input.time}`.trim();
  const proposed = formatProposedSlot(input.proposedDate, input.proposedTime);

  switch (input.action) {
    case 'reschedule_request':
      return {
        title: 'Meeting time update request',
        body: proposed
          ? `Your meeting with ${actorName} — new time proposed: ${proposed}`
          : `Your meeting with ${actorName} — new time proposed`,
      };
    case 'reschedule_accepted':
      return {
        title: 'Meeting time updated',
        body: slot
          ? `${actorName} accepted the meeting time change — ${slot}`
          : `${actorName} accepted the meeting time change`,
      };
    case 'reschedule_declined':
      return {
        title: 'Meeting time update',
        body: `${actorName} rejected the meeting time change`,
      };
    case 'cancel_request':
      return {
        title: 'Cancellation request',
        body: slot
          ? `${actorName} asked to cancel your meeting on ${slot}`
          : `${actorName} asked to cancel your meeting`,
      };
    case 'cancel_approved':
      return {
        title: 'Appointment cancelled',
        body: `${actorName} agreed to cancel the meeting`,
      };
    case 'cancel_declined':
      return {
        title: 'Cancellation declined',
        body: `${actorName} declined to cancel the meeting`,
      };
    default: {
      const verb =
        input.action === 'confirm'
          ? 'confirmed'
          : input.action === 'reject'
            ? 'declined'
            : input.action === 'cancel'
              ? 'cancelled'
              : (APPOINTMENT_STATUS_VERB[input.action] ?? 'updated');
      return {
        title: 'Appointment update',
        body: slot ? `${actorName} ${verb} ${slot}` : `${actorName} ${verb}`,
      };
    }
  }
}

export function draftFromAppointmentReminder(
  input: AppointmentReminderPushInput,
): InAppNotificationDraft {
  const otherParticipantName = truncateTitle(input.otherParticipantName, 48);
  return {
    userId: input.recipientId,
    type: 'appointment_reminder',
    title: 'Meeting in 5 minutes',
    body: `Your meeting with ${otherParticipantName} is in 5 minutes. Open Appointments to find the room link.`,
    data: {
      type: 'appointment_reminder',
      appointmentId: input.appointmentId,
      sessionId: input.sessionId,
      meetingLink: input.meetingLink,
      otherParticipantName: input.otherParticipantName,
    },
  };
}

export function draftFromIntakeExamReminder(
  input: IntakeExamReminderPushInput,
): InAppNotificationDraft {
  const doctorName = truncateTitle(input.doctorName, 48);
  const examName = truncateTitle(input.examName, 48);
  return {
    userId: input.recipientId,
    type: 'intake_exam_reminder',
    title: 'Intake exam due soon',
    body: `Your intake exam "${examName}" from Dr. ${doctorName} is due within 24 hours. Open medical records to complete it.`,
    data: {
      type: 'intake_exam_reminder',
      instanceId: input.instanceId,
      examName: input.examName,
      doctorName: input.doctorName,
      deadlineAt: input.deadlineAt,
    },
  };
}

export function draftFromSystem(
  input: SystemNotificationPushInput,
): InAppNotificationDraft {
  return {
    userId: input.recipientId,
    type: 'system_notification',
    title: truncateTitle(input.title),
    body: truncateBody(input.body),
    data: {
      type: 'system_notification',
    },
  };
}
