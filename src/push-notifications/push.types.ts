export type PushNotificationType =
  | 'chat'
  | 'ai'
  | 'incoming_video_call'
  | 'appointment_request'
  | 'appointment_status'
  | 'appointment_reminder'
  | 'intake_exam_reminder'
  | 'system_notification';

export interface ChatPushInput {
  recipientId: string;
  chatId: string;
  messageId: string;
  senderId: string;
  senderName: string;
  body: string;
}

export interface AiPushInput {
  recipientId: string;
  chatId: string;
  messageId: string;
  body: string;
}

export interface IncomingVideoCallPushInput {
  recipientId: string;
  sessionId: string;
  callerId: string;
  callerName: string;
}

/** Sent when a ringing call stops before it was answered. */
export interface VideoCallCancelledPushInput {
  recipientId: string;
  sessionId: string;
  callerName: string;
}

export interface AppointmentRequestPushInput {
  recipientId: string;
  appointmentId: string;
  patientUserId: string;
  patientName: string;
  date: string;
  time: string;
}

export interface AppointmentStatusPushInput {
  recipientId: string;
  appointmentId: string;
  actorName: string;
  action:
    | 'confirm'
    | 'reject'
    | 'cancel'
    | 'payment_request'
    | 'payment_submitted'
    | 'payment_approved'
    | 'payment_rejected'
    | 'reschedule_request'
    | 'reschedule_accepted'
    | 'reschedule_declined'
    | 'cancel_request'
    | 'cancel_approved'
    | 'cancel_declined';
  date: string;
  time: string;
}

export interface AppointmentReminderPushInput {
  recipientId: string;
  appointmentId: string;
  sessionId: string;
  meetingLink: string;
  when: string;
  otherParticipantName: string;
}

export interface SystemNotificationPushInput {
  recipientId: string;
  title: string;
  body: string;
}

export interface IntakeExamReminderPushInput {
  recipientId: string;
  instanceId: string;
  examName: string;
  doctorName: string;
  deadlineAt: string;
}

export interface PushProvider {
  readonly id: PushProviderId;
  sendChatMessage(input: ChatPushInput): Promise<void>;
  sendAiMessage(input: AiPushInput): Promise<void>;
  sendIncomingVideoCall(input: IncomingVideoCallPushInput): Promise<void>;
  sendVideoCallCancelled(input: VideoCallCancelledPushInput): Promise<void>;
  sendAppointmentRequest(input: AppointmentRequestPushInput): Promise<void>;
  sendAppointmentStatus(input: AppointmentStatusPushInput): Promise<void>;
  sendAppointmentReminder(input: AppointmentReminderPushInput): Promise<void>;
  sendIntakeExamReminder(input: IntakeExamReminderPushInput): Promise<void>;
  sendSystemNotification(input: SystemNotificationPushInput): Promise<void>;
}

export type PushProviderId = 'expo' | 'onesignal';

/** Past-tense verb for each appointment status push. */
export const APPOINTMENT_STATUS_VERB: Record<
  AppointmentStatusPushInput['action'],
  string
> = {
  confirm: 'confirmed',
  reject: 'declined',
  cancel: 'cancelled',
  payment_request: 'asked you to pay for',
  payment_submitted: 'sent payment for',
  payment_approved: 'confirmed payment for',
  payment_rejected: 'rejected the payment for',
  reschedule_request: 'asked to move',
  reschedule_accepted: 'agreed to move',
  reschedule_declined: 'kept the original time for',
  cancel_request: 'asked to cancel',
  cancel_approved: 'agreed to cancel',
  cancel_declined: 'declined cancelling',
};
