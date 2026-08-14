export type PushNotificationType = 'chat' | 'ai' | 'incoming_video_call';

export interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data: Record<string, string>;
  sound: 'default';
  channelId: string;
  priority: 'high' | 'default';
  /** iOS 15+: 'timeSensitive' cuts through Focus modes — calls only. */
  interruptionLevel?: 'active' | 'timeSensitive' | 'critical';
  /** iOS: stacks notifications sharing this id into one group. */
  threadId?: string;
  /** Android: a new notification replaces the shown one with the same tag. */
  tag?: string;
}

export interface ExpoPushTicket {
  status: 'ok' | 'error';
  message?: string;
  details?: { error?: string };
}

export type { AiPushInput, ChatPushInput } from './push.types';
