import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Prescription } from '../entities/prescription.entity';
import { PrescriptionMedication } from '../entities/prescription-medication.entity';
import { Doctor } from '../entities/doctor.entity';
import { Patient } from '../entities/patient.entity';
import { Clinic } from '../entities/clinic.entity';
import { PatientProfile } from '../entities/patient-profile.entity';
import { User } from '../entities/user.entity';
import { MedicalDocument } from '../entities/medical-document.entity';
import { Consultation } from '../entities/consultation.entity';
import { Diagnosis } from '../entities/diagnosis.entity';
import { PrescriptionsService } from './prescriptions.service';
import { PrescriptionsController } from './prescriptions.controller';
import { PrescriptionImageAnalyzerService } from './prescription-image-analyzer.service';
import { UploadsModule } from '../uploads/uploads.module';
import { AiModule } from '../ai/ai.module';
import { DoctorPatientAccessModule } from '../doctor-patient-access/doctor-patient-access.module';
import { PatientsModule } from '../patients/patients.module';
import { MedicalRecordAiModule } from '../medical-documents/medical-record-ai.module';
import { PointsModule } from '../points/points.module';
import { UsersModule } from '../users/users.module';

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
      MedicalDocument,
      Consultation,
      Diagnosis,
    ]),
    UploadsModule,
    AiModule,
    DoctorPatientAccessModule,
    PatientsModule,
    PointsModule,
    MedicalRecordAiModule,
    UsersModule,
  ],
  providers: [PrescriptionsService, PrescriptionImageAnalyzerService],
  controllers: [PrescriptionsController],
  exports: [PrescriptionsService],
})
export class PrescriptionsModule {}
