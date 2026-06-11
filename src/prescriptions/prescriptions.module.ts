import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Prescription } from '../entities/prescription.entity';
import { Doctor } from '../entities/doctor.entity';
import { Patient } from '../entities/patient.entity';
import { Clinic } from '../entities/clinic.entity';
import { PrescriptionsService } from './prescriptions.service';
import { PrescriptionsController } from './prescriptions.controller';
import { UploadsModule } from '../uploads/uploads.module';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Prescription, Doctor, Patient, Clinic]),
    UploadsModule,
    AiModule,
  ],
  providers: [PrescriptionsService],
  controllers: [PrescriptionsController],
})
export class PrescriptionsModule {}
