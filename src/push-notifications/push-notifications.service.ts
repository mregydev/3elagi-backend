import { Injectable } from '@nestjs/common';
import { PushProviderFactory } from './push-provider.factory';
import type { AiPushInput, ChatPushInput } from './push.types';

@Injectable()
export class PushNotificationsService {
  constructor(private readonly factory: PushProviderFactory) {}

  async sendChatMessage(input: ChatPushInput): Promise<void> {
    await this.factory.getActive().sendChatMessage(input);
  }

  async sendAiMessage(input: AiPushInput): Promise<void> {
    await this.factory.getActive().sendAiMessage(input);
  }
}
