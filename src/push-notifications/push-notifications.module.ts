import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DeviceToken } from '../entities/device-token.entity';
import { DeviceTokensService } from './device-tokens.service';
import { OneSignalPushClient } from './onesignal-push.client';
import { PushNotificationsService } from './push-notifications.service';

@Module({
  imports: [TypeOrmModule.forFeature([DeviceToken])],
  providers: [
    DeviceTokensService,
    OneSignalPushClient,
    PushNotificationsService,
  ],
  exports: [DeviceTokensService, PushNotificationsService],
})
export class PushNotificationsModule {}
