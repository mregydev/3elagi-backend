import { Injectable, Logger } from '@nestjs/common';
import { PresenceService } from '../presence/presence.service';
import { PushProviderFactory } from './push-provider.factory';
import type {
  AiPushInput,
  AppointmentReminderPushInput,
  AppointmentRequestPushInput,
  AppointmentStatusPushInput,
  ChatPushInput,
  IncomingVideoCallPushInput,
} from './push.types';

@Injectable()
export class PushNotificationsService {
  private readonly logger = new Logger(PushNotificationsService.name);

  constructor(
    private readonly factory: PushProviderFactory,
    private readonly presence: PresenceService,
  ) {}

  async sendChatMessage(input: ChatPushInput): Promise<void> {
    if (this.presence.isUserOnline(input.recipientId)) {
      this.logger.debug(
        `Chat push skipped — recipient ${input.recipientId} is online`,
      );
      return;
    }
    await this.factory.getActive().sendChatMessage(input);
  }

  async sendAiMessage(input: AiPushInput): Promise<void> {
    if (this.presence.isUserOnline(input.recipientId)) {
      this.logger.debug(
        `AI push skipped — recipient ${input.recipientId} is online`,
      );
      return;
    }
    await this.factory.getActive().sendAiMessage(input);
  }

  /** Always delivered — rings even when the doctor is online in the app. */
  async sendIncomingVideoCall(input: IncomingVideoCallPushInput): Promise<void> {
    await this.factory.getActive().sendIncomingVideoCall(input);
  }

  async sendAppointmentRequest(input: AppointmentRequestPushInput): Promise<void> {
    if (this.presence.isUserOnline(input.recipientId)) return;
    await this.factory.getActive().sendAppointmentRequest(input);
  }

  async sendAppointmentStatus(input: AppointmentStatusPushInput): Promise<void> {
    if (this.presence.isUserOnline(input.recipientId)) return;
    await this.factory.getActive().sendAppointmentStatus(input);
  }

  async sendAppointmentReminder(input: AppointmentReminderPushInput): Promise<void> {
    if (this.presence.isUserOnline(input.recipientId)) return;
    await this.factory.getActive().sendAppointmentReminder(input);
  }
}
