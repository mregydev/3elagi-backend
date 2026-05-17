import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PatientsController, PatientSelfController } from './patients.controller';
import { PatientsService } from './patients.service';
import { Patient } from '../entities/patient.entity';
import { PatientProfile } from '../entities/patient-profile.entity';
import { User } from '../entities/user.entity';
import { MedicalDocument } from '../entities/medical-document.entity';
import { Clinic } from '../entities/clinic.entity';
import { Doctor } from '../entities/doctor.entity';
import { Appointment } from '../entities/appointment.entity';
import { IntakeTest } from '../entities/intake-test.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Patient,
      PatientProfile,
      User,
      MedicalDocument,
      Clinic,
      Doctor,
      Appointment,
      IntakeTest,
    ]),
  ],
  controllers: [PatientsController, PatientSelfController],
  providers: [PatientsService],
  exports: [PatientsService],
})
export class PatientsModule {}
