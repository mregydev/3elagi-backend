import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Doctor } from '../entities/doctor.entity';
import { DoctorSpeciality } from '../entities/doctor-speciality.entity';
import { DoctorPatientAccess } from '../entities/doctor-patient-access.entity';
import { MedicalDocument } from '../entities/medical-document.entity';
import { Message } from '../entities/message.entity';
import { PatientProfile } from '../entities/patient-profile.entity';
import { SpecialtyTestAccount } from '../entities/specialty-test-account.entity';
import { User } from '../entities/user.entity';
import { DoctorOnboardingService } from './doctor-onboarding.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Doctor,
      DoctorSpeciality,
      User,
      PatientProfile,
      SpecialtyTestAccount,
      MedicalDocument,
      DoctorPatientAccess,
      Message,
    ]),
  ],
  providers: [DoctorOnboardingService],
  exports: [DoctorOnboardingService],
})
export class DoctorOnboardingModule {}
