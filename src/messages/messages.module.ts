import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Message } from '../entities/message.entity';
import { User } from '../entities/user.entity';
import { UsersModule } from '../users/users.module';
import { PresenceModule } from '../presence/presence.module';
import { DoctorPatientAccessModule } from '../doctor-patient-access/doctor-patient-access.module';
import { MessagesController } from './messages.controller';
import { MessagesService } from './messages.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Message, User]),
    UsersModule,
    PresenceModule,
    DoctorPatientAccessModule,
  ],
  controllers: [MessagesController],
  providers: [MessagesService],
  exports: [MessagesService],
})
export class MessagesModule {}
