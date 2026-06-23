export type PushNotificationType = 'chat' | 'ai';

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

export interface PushProvider {
  readonly id: PushProviderId;
  sendChatMessage(input: ChatPushInput): Promise<void>;
  sendAiMessage(input: AiPushInput): Promise<void>;
}

export type PushProviderId = 'expo' | 'onesignal';
