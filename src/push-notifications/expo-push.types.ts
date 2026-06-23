export type PushNotificationType = 'chat' | 'ai';

export interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data: {
    chatId: string;
    messageId: string;
    type: PushNotificationType;
    senderId?: string;
  };
  sound: 'default';
  channelId: string;
  priority: 'high' | 'default';
}

export interface ExpoPushTicket {
  status: 'ok' | 'error';
  message?: string;
  details?: { error?: string };
}

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
