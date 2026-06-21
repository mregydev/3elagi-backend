import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DoctorsController } from './doctors.controller';
import { DoctorsService } from './doctors.service';
import { Doctor } from '../entities/doctor.entity';
import { Clinic } from '../entities/clinic.entity';
import { DoctorSpeciality } from '../entities/doctor-speciality.entity';
import { AiModule } from '../ai/ai.module';
import { PresenceModule } from '../presence/presence.module';
import { SpecialitiesModule } from '../specialities/specialities.module';
import { ReviewsModule } from '../reviews/reviews.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Doctor, Clinic, DoctorSpeciality]),
    AiModule,
    PresenceModule,
    SpecialitiesModule,
    ReviewsModule,
  ],
  controllers: [DoctorsController],
  providers: [DoctorsService],
  exports: [DoctorsService],
})
export class DoctorsModule {}
