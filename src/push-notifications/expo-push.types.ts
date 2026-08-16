export type PushNotificationType = 'chat' | 'ai' | 'incoming_video_call';

export interface ExpoPushMessage {
  to: string;
  /**
   * Omitted by data-only pushes (the call ones): leaving title/body/sound off
   * makes FCM deliver to onMessageReceived even when the app is killed, and the
   * native layer draws the CallStyle UI and plays the ringtone itself. Those
   * carry their copy inside `data` instead.
   */
  title?: string;
  body?: string;
  data: Record<string, string>;
  /** 'default', or a sound bundled in the app (e.g. the call ringtone). */
  sound?: 'default' | (string & {});
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
