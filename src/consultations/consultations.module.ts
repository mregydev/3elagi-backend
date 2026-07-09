import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Consultation } from '../entities/consultation.entity';
import { Doctor } from '../entities/doctor.entity';
import { User } from '../entities/user.entity';
import { Message } from '../entities/message.entity';
import { PointsModule } from '../points/points.module';
import { PresenceModule } from '../presence/presence.module';
import { DiagnosisModule } from '../diagnosis/diagnosis.module';
import { UsersModule } from '../users/users.module';
import { ConsultationsController } from './consultations.controller';
import { ConsultationsService } from './consultations.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Consultation, Doctor, User, Message]),
    PointsModule,
    PresenceModule,
    DiagnosisModule,
    UsersModule,
  ],
  controllers: [ConsultationsController],
  providers: [ConsultationsService],
  exports: [ConsultationsService],
})
export class ConsultationsModule {}
