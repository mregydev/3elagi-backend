import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { User } from '../entities/user.entity';
import { VideoCallSession } from '../entities/video-call-session.entity';
import { PushNotificationsModule } from '../push-notifications/push-notifications.module';
import { UsersModule } from '../users/users.module';
import { WherebyModule } from '../whereby/whereby.module';
import { VideoCallsController } from './video-calls.controller';
import { VideoCallsService } from './video-calls.service';

@Module({
  imports: [
    AuthModule,
    WherebyModule,
    UsersModule,
    PushNotificationsModule,
    TypeOrmModule.forFeature([VideoCallSession, User]),
  ],
  controllers: [VideoCallsController],
  providers: [VideoCallsService],
})
export class VideoCallsModule {}
