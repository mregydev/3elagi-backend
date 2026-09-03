import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiModule } from '../ai/ai.module';
import { Doctor } from '../entities/doctor.entity';
import { DoctorSpeciality } from '../entities/doctor-speciality.entity';
import { DoctorPatientAccess } from '../entities/doctor-patient-access.entity';
import { MedicalDocument } from '../entities/medical-document.entity';
import { Message } from '../entities/message.entity';
import { PatientProfile } from '../entities/patient-profile.entity';
import { SpecialtyTestAccount } from '../entities/specialty-test-account.entity';
import { User } from '../entities/user.entity';
import { PresenceModule } from '../presence/presence.module';
import { PushNotificationsModule } from '../push-notifications/push-notifications.module';
import { UsersModule } from '../users/users.module';
import { DoctorOnboardingService } from './doctor-onboarding.service';
import { TestPatientAiService } from './test-patient-ai.service';

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
    AiModule,
    PresenceModule,
    PushNotificationsModule,
    UsersModule,
  ],
  providers: [DoctorOnboardingService, TestPatientAiService],
  exports: [DoctorOnboardingService, TestPatientAiService],
})
export class DoctorOnboardingModule {}
