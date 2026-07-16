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
import { PatientsModule } from '../patients/patients.module';
import { AiModule } from '../ai/ai.module';
import { MedicalRecordAiModule } from '../medical-documents/medical-record-ai.module';
import { UploadsModule } from '../uploads/uploads.module';
import { PrescriptionsModule } from '../prescriptions/prescriptions.module';
import { IntakeExamsModule } from '../intake-exams/intake-exams.module';
import { Prescription } from '../entities/prescription.entity';
import { IntakeExamAssignment } from '../entities/intake-exam-assignment.entity';

@Module({
  imports: [
    DoctorPatientAccessModule,
    PatientsModule,
    AiModule,
    MedicalRecordAiModule,
    UploadsModule,
    PrescriptionsModule,
    IntakeExamsModule,
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
      Prescription,
      IntakeExamAssignment,
    ]),
  ],
  controllers: [DiagnosisController, PatientDiagnosisController],
  providers: [DiagnosisService, DiagnosisDocumentService],
  exports: [DiagnosisService, DiagnosisDocumentService],
})
export class DiagnosisModule {}
