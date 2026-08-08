import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DeviceToken } from '../entities/device-token.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { PresenceModule } from '../presence/presence.module';
import { DeviceTokensService } from './device-tokens.service';
import { ExpoPushClient } from './expo-push.client';
import { OneSignalPushClient } from './onesignal-push.client';
import { ExpoPushProvider } from './providers/expo-push.provider';
import { OneSignalPushProvider } from './providers/onesignal-push.provider';
import { PushProviderFactory } from './push-provider.factory';
import { PushNotificationsService } from './push-notifications.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([DeviceToken]),
    PresenceModule,
    NotificationsModule,
  ],
  providers: [
    DeviceTokensService,
    ExpoPushClient,
    OneSignalPushClient,
    ExpoPushProvider,
    OneSignalPushProvider,
    PushProviderFactory,
    PushNotificationsService,
  ],
  exports: [DeviceTokensService, PushNotificationsService],
})
export class PushNotificationsModule {}
