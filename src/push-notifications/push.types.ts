export type PushNotificationType =
  | 'chat'
  | 'ai'
  | 'incoming_video_call'
  | 'appointment_request'
  | 'appointment_status'
  | 'appointment_reminder';

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
  action: 'confirm' | 'reject' | 'cancel';
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

export interface PushProvider {
  readonly id: PushProviderId;
  sendChatMessage(input: ChatPushInput): Promise<void>;
  sendAiMessage(input: AiPushInput): Promise<void>;
  sendIncomingVideoCall(input: IncomingVideoCallPushInput): Promise<void>;
  sendAppointmentRequest(input: AppointmentRequestPushInput): Promise<void>;
  sendAppointmentStatus(input: AppointmentStatusPushInput): Promise<void>;
  sendAppointmentReminder(input: AppointmentReminderPushInput): Promise<void>;
}

export type PushProviderId = 'expo' | 'onesignal';
