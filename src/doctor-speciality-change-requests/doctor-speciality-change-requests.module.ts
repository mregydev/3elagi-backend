import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Doctor } from '../entities/doctor.entity';
import { DoctorSpeciality } from '../entities/doctor-speciality.entity';
import { DoctorSpecialityChangeRequest } from '../entities/doctor-speciality-change-request.entity';
import { DoctorOnboardingModule } from '../doctor-onboarding/doctor-onboarding.module';
import { AiModule } from '../ai/ai.module';
import { DoctorTagsModule } from '../doctor-tags/doctor-tags.module';
import { DoctorSpecialityChangeRequestsService } from './doctor-speciality-change-requests.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      DoctorSpecialityChangeRequest,
      Doctor,
      DoctorSpeciality,
    ]),
    DoctorOnboardingModule,
    AiModule,
    DoctorTagsModule,
  ],
  providers: [DoctorSpecialityChangeRequestsService],
  exports: [DoctorSpecialityChangeRequestsService],
})
export class DoctorSpecialityChangeRequestsModule {}
