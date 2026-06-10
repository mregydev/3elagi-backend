import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DiagnosisController } from './diagnosis.controller';
import { PatientDiagnosisController } from './patient-diagnosis.controller';
import { DiagnosisService } from './diagnosis.service';
import { Diagnosis } from '../entities/diagnosis.entity';
import { Patient } from '../entities/patient.entity';
import { Doctor } from '../entities/doctor.entity';
import { Symptom } from '../entities/symptom.entity';
import { User } from '../entities/user.entity';
import { Appointment } from '../entities/appointment.entity';
import { PatientProfile } from '../entities/patient-profile.entity';
import { MedicalDocument } from '../entities/medical-document.entity';
import { DoctorPatientAccessModule } from '../doctor-patient-access/doctor-patient-access.module';

@Module({
  imports: [
    DoctorPatientAccessModule,
    TypeOrmModule.forFeature([
      Diagnosis,
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
  providers: [DiagnosisService],
  exports: [DiagnosisService],
})
export class DiagnosisModule {}
