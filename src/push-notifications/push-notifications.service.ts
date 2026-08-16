import { Injectable, Logger } from '@nestjs/common';
import { NotificationsService } from '../notifications/notifications.service';
import {
  draftFromAi,
  draftFromAppointmentReminder,
  draftFromAppointmentRequest,
  draftFromAppointmentStatus,
  draftFromChat,
  draftFromIncomingVideoCall,
  draftFromIntakeExamReminder,
  draftFromSystem,
} from '../notifications/notification-content';
import { PresenceService } from '../presence/presence.service';
import { PushProviderFactory } from './push-provider.factory';
import type {
  AiPushInput,
  AppointmentReminderPushInput,
  AppointmentRequestPushInput,
  AppointmentStatusPushInput,
  ChatPushInput,
  IncomingVideoCallPushInput,
  VideoCallCancelledPushInput,
  IntakeExamReminderPushInput,
  SystemNotificationPushInput,
} from './push.types';

/**
 * "Ahmed: see you tomorrow" — the name has to sit next to the text, because a
 * collapsed, grouped or lock-screen notification often shows the body alone.
 * Skipped when the body already opens with the name, with or without a colon
 * ("Ahmed uploaded a new X-ray document" reads fine on its own).
 */
export function withSenderName(senderName: string, body: string): string {
  const name = senderName?.trim();
  const text = body?.trim();
  if (!name) return text;
  if (!text) return name;
  if (text.toLowerCase().startsWith(name.toLowerCase())) return text;
  return `${name}: ${text}`;
}

@Injectable()
export class PushNotificationsService {
  private readonly logger = new Logger(PushNotificationsService.name);

  constructor(
    private readonly factory: PushProviderFactory,
    private readonly presence: PresenceService,
    private readonly inApp: NotificationsService,
  ) {}

  /**
   * `alwaysPush` bypasses the online check for decisions the recipient must not
   * miss (a doctor accepting or declining a consultation). "Online" only means
   * a socket exists — the app may be backgrounded, or the user may be on a
   * different screen entirely.
   */
  async sendChatMessage(
    input: ChatPushInput,
    opts?: { alwaysPush?: boolean },
  ): Promise<void> {
    // In-app rows keep the plain body — the sender is already their title.
    await this.safePersist(draftFromChat(input));
    if (!opts?.alwaysPush && this.presence.isUserOnline(input.recipientId)) {
      this.logger.debug(
        `Chat push skipped — recipient ${input.recipientId} is online`,
      );
      return;
    }
    await this.factory.getActive().sendChatMessage({
      ...input,
      body: withSenderName(input.senderName, input.body),
    });
  }

  /** Persist in-app AI notification; remote push stays off (mobile policy). */
  async recordAiMessage(input: AiPushInput): Promise<void> {
    await this.safePersist(draftFromAi(input));
  }

  async sendAiMessage(input: AiPushInput): Promise<void> {
    await this.safePersist(draftFromAi(input));
    if (this.presence.isUserOnline(input.recipientId)) {
      this.logger.debug(
        `AI push skipped — recipient ${input.recipientId} is online`,
      );
      return;
    }
    await this.factory.getActive().sendAiMessage(input);
  }

  /**
   * Always pushed, unlike every other kind. A ringing call cannot rely on the
   * socket: "online" only means a socket exists, and the callee's app may be
   * backgrounded or the socket stale — either way they would never hear it.
   * (Calls are also only placed to doctors we already know are connected, so
   * suppressing on presence meant this push effectively never fired.)
   */
  async sendIncomingVideoCall(input: IncomingVideoCallPushInput): Promise<void> {
    await this.safePersist(draftFromIncomingVideoCall(input));
    await this.factory.getActive().sendIncomingVideoCall(input);
  }

  /** No draft row: this only clears the ringing entry from the tray. */
  async sendVideoCallCancelled(
    input: VideoCallCancelledPushInput,
  ): Promise<void> {
    await this.factory.getActive().sendVideoCallCancelled(input);
  }

  async sendAppointmentRequest(input: AppointmentRequestPushInput): Promise<void> {
    await this.safePersist(draftFromAppointmentRequest(input));
    if (this.presence.isUserOnline(input.recipientId)) return;
    await this.factory.getActive().sendAppointmentRequest(input);
  }

  async sendAppointmentStatus(input: AppointmentStatusPushInput): Promise<void> {
    await this.safePersist(draftFromAppointmentStatus(input));
    if (this.presence.isUserOnline(input.recipientId)) return;
    await this.factory.getActive().sendAppointmentStatus(input);
  }

  async sendAppointmentReminder(input: AppointmentReminderPushInput): Promise<void> {
    await this.safePersist(draftFromAppointmentReminder(input));
    if (this.presence.isUserOnline(input.recipientId)) return;
    await this.factory.getActive().sendAppointmentReminder(input);
  }

  async sendIntakeExamReminder(input: IntakeExamReminderPushInput): Promise<void> {
    await this.safePersist(draftFromIntakeExamReminder(input));
    if (this.presence.isUserOnline(input.recipientId)) return;
    await this.factory.getActive().sendIntakeExamReminder(input);
  }

  async sendSystemNotification(input: SystemNotificationPushInput): Promise<void> {
    await this.safePersist(draftFromSystem(input));
    if (this.presence.isUserOnline(input.recipientId)) return;
    await this.factory.getActive().sendSystemNotification(input);
  }

  private async safePersist(
    draft: Parameters<NotificationsService['create']>[0],
  ): Promise<void> {
    try {
      await this.inApp.create(draft);
    } catch (err) {
      this.logger.warn(
        `Failed to persist in-app notification for ${draft.userId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }
}
