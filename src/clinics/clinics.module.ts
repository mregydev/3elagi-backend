import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClinicsController } from './clinics.controller';
import { ClinicsService } from './clinics.service';
import { Clinic } from '../entities/clinic.entity';
import { Appointment } from '../entities/appointment.entity';
import { Doctor } from '../entities/doctor.entity';
import { ClinicJoinRequest } from '../entities/clinic-join-request.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Clinic, Appointment, Doctor, ClinicJoinRequest])],
  controllers: [ClinicsController],
  providers: [ClinicsService],
  exports: [ClinicsService],
})
export class ClinicsModule {}
