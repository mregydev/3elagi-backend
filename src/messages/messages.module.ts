import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Message } from '../entities/message.entity';
import { User } from '../entities/user.entity';
import { UsersModule } from '../users/users.module';
import { PresenceModule } from '../presence/presence.module';
import { DoctorPatientAccessModule } from '../doctor-patient-access/doctor-patient-access.module';
import { PointsModule } from '../points/points.module';
import { MessageEmotionsModule } from '../message-emotions/message-emotions.module';
import { MessageEmotionsService } from '../message-emotions/message-emotions.service';
import { MessagesController } from './messages.controller';
import { MessagesService } from './messages.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Message, User]),
    UsersModule,
    PresenceModule,
    DoctorPatientAccessModule,
    PointsModule,
    MessageEmotionsModule,
  ],
  controllers: [MessagesController],
  providers: [MessagesService],
  exports: [MessagesService],
})
export class MessagesModule {}
