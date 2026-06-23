import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DeviceToken } from '../entities/device-token.entity';
import { DeviceTokensService } from './device-tokens.service';
import { ExpoPushClient } from './expo-push.client';
import { PushNotificationsService } from './push-notifications.service';

@Module({
  imports: [TypeOrmModule.forFeature([DeviceToken])],
  providers: [DeviceTokensService, ExpoPushClient, PushNotificationsService],
  exports: [DeviceTokensService, PushNotificationsService],
})
export class PushNotificationsModule {}
