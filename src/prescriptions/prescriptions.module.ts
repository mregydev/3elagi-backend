import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Prescription } from '../entities/prescription.entity';
import { PrescriptionMedication } from '../entities/prescription-medication.entity';
import { Doctor } from '../entities/doctor.entity';
import { Patient } from '../entities/patient.entity';
import { Clinic } from '../entities/clinic.entity';
import { PatientProfile } from '../entities/patient-profile.entity';
import { User } from '../entities/user.entity';
import { PrescriptionsService } from './prescriptions.service';
import { PrescriptionsController } from './prescriptions.controller';
import { PrescriptionImageAnalyzerService } from './prescription-image-analyzer.service';
import { UploadsModule } from '../uploads/uploads.module';
import { AiModule } from '../ai/ai.module';
import { DoctorPatientAccessModule } from '../doctor-patient-access/doctor-patient-access.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Prescription,
      PrescriptionMedication,
      Doctor,
      Patient,
      Clinic,
      PatientProfile,
      User,
    ]),
    UploadsModule,
    AiModule,
    DoctorPatientAccessModule,
  ],
  providers: [PrescriptionsService, PrescriptionImageAnalyzerService],
  controllers: [PrescriptionsController],
})
export class PrescriptionsModule {}
