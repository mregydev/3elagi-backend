export type PushNotificationType = 'chat' | 'ai' | 'incoming_video_call';

export interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data: Record<string, string>;
  sound: 'default';
  channelId: string;
  priority: 'high' | 'default';
}

export interface ExpoPushTicket {
  status: 'ok' | 'error';
  message?: string;
  details?: { error?: string };
}

export type { AiPushInput, ChatPushInput } from './push.types';
