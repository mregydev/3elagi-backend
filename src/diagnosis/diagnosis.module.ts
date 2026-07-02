import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DiagnosisController } from './diagnosis.controller';
import { PatientDiagnosisController } from './patient-diagnosis.controller';
import { DiagnosisService } from './diagnosis.service';
import { DiagnosisDocumentService } from './diagnosis-document.service';
import { Diagnosis } from '../entities/diagnosis.entity';
import { DiagnosisDocument } from '../entities/diagnosis-document.entity';
import { Patient } from '../entities/patient.entity';
import { Doctor } from '../entities/doctor.entity';
import { Symptom } from '../entities/symptom.entity';
import { User } from '../entities/user.entity';
import { Appointment } from '../entities/appointment.entity';
import { PatientProfile } from '../entities/patient-profile.entity';
import { MedicalDocument } from '../entities/medical-document.entity';
import { DoctorPatientAccessModule } from '../doctor-patient-access/doctor-patient-access.module';
import { AiModule } from '../ai/ai.module';
import { MedicalRecordAiModule } from '../medical-documents/medical-record-ai.module';
import { UploadsModule } from '../uploads/uploads.module';

@Module({
  imports: [
    DoctorPatientAccessModule,
    AiModule,
    MedicalRecordAiModule,
    UploadsModule,
    TypeOrmModule.forFeature([
      Diagnosis,
      DiagnosisDocument,
      Patient,
      Doctor,
      Symptom,
      User,
      Appointment,
      PatientProfile,
      MedicalDocument,
    ]),
  ],
  controllers: [DiagnosisController, PatientDiagnosisController],
  providers: [DiagnosisService, DiagnosisDocumentService],
  exports: [DiagnosisService, DiagnosisDocumentService],
})
export class DiagnosisModule {}
