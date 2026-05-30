import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SpecialitiesController } from './specialities.controller';
import { SpecialitiesService } from './specialities.service';
import { DoctorSpeciality } from '../entities/doctor-speciality.entity';
import { Doctor } from '../entities/doctor.entity';
import { User } from '../entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([DoctorSpeciality, Doctor, User])],
  controllers: [SpecialitiesController],
  providers: [SpecialitiesService],
  exports: [SpecialitiesService],
})
export class SpecialitiesModule {}
