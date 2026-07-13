import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { User } from '../entities/user.entity';
import { Doctor } from '../entities/doctor.entity';
import { VideoCallSession } from '../entities/video-call-session.entity';
import { PushNotificationsModule } from '../push-notifications/push-notifications.module';
import { PresenceModule } from '../presence/presence.module';
import { UsersModule } from '../users/users.module';
import { DailyModule } from '../daily/daily.module';
import { VideoCallsController } from './video-calls.controller';
import { VideoCallsService } from './video-calls.service';

@Module({
  imports: [
    AuthModule,
    DailyModule,
    UsersModule,
    PushNotificationsModule,
    PresenceModule,
    TypeOrmModule.forFeature([VideoCallSession, User, Doctor]),
  ],
  controllers: [VideoCallsController],
  providers: [VideoCallsService],
})
export class VideoCallsModule {}
