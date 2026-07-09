import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConsultationComplaint } from '../entities/consultation-complaint.entity';
import { Consultation } from '../entities/consultation.entity';
import { Message } from '../entities/message.entity';
import { PointsModule } from '../points/points.module';
import { PresenceModule } from '../presence/presence.module';
import { PushNotificationsModule } from '../push-notifications/push-notifications.module';
import { UsersModule } from '../users/users.module';
import { ComplaintsController } from './complaints.controller';
import { ComplaintsService } from './complaints.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ConsultationComplaint, Consultation, Message]),
    PointsModule,
    PresenceModule,
    PushNotificationsModule,
    UsersModule,
  ],
  controllers: [ComplaintsController],
  providers: [ComplaintsService],
})
export class ComplaintsModule {}
