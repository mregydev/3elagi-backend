import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ACTIVE_PUSH_PROVIDER } from './push.config';
import { ExpoPushProvider } from './providers/expo-push.provider';
import { OneSignalPushProvider } from './providers/onesignal-push.provider';
import type { PushProvider } from './push.types';

@Injectable()
export class PushProviderFactory implements OnModuleInit {
  private readonly logger = new Logger(PushProviderFactory.name);

  constructor(
    private readonly expo: ExpoPushProvider,
    private readonly oneSignal: OneSignalPushProvider,
  ) {}

  onModuleInit(): void {
    this.logger.log(`Active push provider: ${ACTIVE_PUSH_PROVIDER}`);
  }

  getActive(): PushProvider {
    if (ACTIVE_PUSH_PROVIDER === 'onesignal') {
      return this.oneSignal;
    }
    return this.expo;
  }
}
