import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MedicalDocumentsController } from './medical-documents.controller';
import { PatientMedicalDocumentsController } from './patient-medical-documents.controller';
import { MedicalDocumentsService } from './medical-documents.service';
import { MedicalDocument } from '../entities/medical-document.entity';
import { Patient } from '../entities/patient.entity';
import { User } from '../entities/user.entity';
import { Doctor } from '../entities/doctor.entity';
import { Diagnosis } from '../entities/diagnosis.entity';
import { Symptom } from '../entities/symptom.entity';
import { DoctorPatientAccessModule } from '../doctor-patient-access/doctor-patient-access.module';
import { AiModule } from '../ai/ai.module';
import { DiagnosisModule } from '../diagnosis/diagnosis.module';
import { UploadsModule } from '../uploads/uploads.module';
import { MedicalRecordAiModule } from './medical-record-ai.module';

@Module({
  imports: [
    DoctorPatientAccessModule,
    AiModule,
    DiagnosisModule,
    UploadsModule,
    MedicalRecordAiModule,
    TypeOrmModule.forFeature([MedicalDocument, Patient, User, Doctor, Diagnosis, Symptom]),
  ],
  controllers: [MedicalDocumentsController, PatientMedicalDocumentsController],
  providers: [MedicalDocumentsService],
  exports: [MedicalDocumentsService, MedicalRecordAiModule],
})
export class MedicalDocumentsModule {}
