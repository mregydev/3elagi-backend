import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Message } from '../entities/message.entity';
import { User } from '../entities/user.entity';
import { UsersModule } from '../users/users.module';
import { PresenceModule } from '../presence/presence.module';
import { DoctorPatientAccessModule } from '../doctor-patient-access/doctor-patient-access.module';
import { MessageEmotionsModule } from '../message-emotions/message-emotions.module';
import { PushNotificationsModule } from '../push-notifications/push-notifications.module';
import { AppointmentsModule } from '../appointments/appointments.module';
import { ConsultationsModule } from '../consultations/consultations.module';
import { MessageEmotionsService } from '../message-emotions/message-emotions.service';
import { MessagesController } from './messages.controller';
import { MessagesService } from './messages.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Message, User]),
    UsersModule,
    PresenceModule,
    DoctorPatientAccessModule,
    MessageEmotionsModule,
    PushNotificationsModule,
    forwardRef(() => AppointmentsModule),
    ConsultationsModule,
  ],
  controllers: [MessagesController],
  providers: [MessagesService],
  exports: [MessagesService],
})
export class MessagesModule {}
