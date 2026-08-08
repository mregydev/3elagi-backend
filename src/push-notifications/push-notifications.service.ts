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
  IntakeExamReminderPushInput,
  SystemNotificationPushInput,
} from './push.types';

@Injectable()
export class PushNotificationsService {
  private readonly logger = new Logger(PushNotificationsService.name);

  constructor(
    private readonly factory: PushProviderFactory,
    private readonly presence: PresenceService,
    private readonly inApp: NotificationsService,
  ) {}

  async sendChatMessage(input: ChatPushInput): Promise<void> {
    await this.safePersist(draftFromChat(input));
    if (this.presence.isUserOnline(input.recipientId)) {
      this.logger.debug(
        `Chat push skipped — recipient ${input.recipientId} is online`,
      );
      return;
    }
    await this.factory.getActive().sendChatMessage(input);
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

  async sendIncomingVideoCall(input: IncomingVideoCallPushInput): Promise<void> {
    await this.safePersist(draftFromIncomingVideoCall(input));
    if (this.presence.isUserOnline(input.recipientId)) {
      this.logger.debug(
        `Incoming call push skipped — recipient ${input.recipientId} is online`,
      );
      return;
    }
    await this.factory.getActive().sendIncomingVideoCall(input);
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
