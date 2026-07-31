import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConsultationComplaint } from '../entities/consultation-complaint.entity';
import { Consultation } from '../entities/consultation.entity';
import { Doctor } from '../entities/doctor.entity';
import { User } from '../entities/user.entity';
import { Message } from '../entities/message.entity';
import { AiModule } from '../ai/ai.module';
import { DoctorPatientAccessModule } from '../doctor-patient-access/doctor-patient-access.module';
import { PointsModule } from '../points/points.module';
import { PresenceModule } from '../presence/presence.module';
import { DiagnosisModule } from '../diagnosis/diagnosis.module';
import { UsersModule } from '../users/users.module';
import { ConsultationsController } from './consultations.controller';
import { ConsultationsService } from './consultations.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Consultation,
      ConsultationComplaint,
      Doctor,
      User,
      Message,
    ]),
    AiModule,
    DoctorPatientAccessModule,
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
