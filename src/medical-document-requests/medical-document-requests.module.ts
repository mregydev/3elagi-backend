import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MedicalDocumentRequest } from '../entities/medical-document-request.entity';
import { Doctor } from '../entities/doctor.entity';
import { Patient } from '../entities/patient.entity';
import { User } from '../entities/user.entity';
import { MedicalDocument } from '../entities/medical-document.entity';
import { PatientProfile } from '../entities/patient-profile.entity';
import { Clinic } from '../entities/clinic.entity';
import { MedicalDocumentRequestsService } from './medical-document-requests.service';
import { MedicalDocumentRequestsController } from './medical-document-requests.controller';
import { PatientMedicalDocumentRequestsController } from './patient-medical-document-requests.controller';
import { DoctorPatientAccessModule } from '../doctor-patient-access/doctor-patient-access.module';
import { PatientsModule } from '../patients/patients.module';
import { UploadsModule } from '../uploads/uploads.module';
import { MedicalRecordAiModule } from '../medical-documents/medical-record-ai.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MedicalDocumentRequest,
      Doctor,
      Patient,
      User,
      MedicalDocument,
      PatientProfile,
      Clinic,
    ]),
    DoctorPatientAccessModule,
    PatientsModule,
    UploadsModule,
    MedicalRecordAiModule,
  ],
  controllers: [MedicalDocumentRequestsController, PatientMedicalDocumentRequestsController],
  providers: [MedicalDocumentRequestsService],
  exports: [MedicalDocumentRequestsService],
})
export class MedicalDocumentRequestsModule {}
