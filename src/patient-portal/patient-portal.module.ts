import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PatientPortalController } from './patient-portal.controller';
import { PatientPortalService } from './patient-portal.service';
import { SchedulesModule } from '../schedules/schedules.module';
import { UploadsModule } from '../uploads/uploads.module';
import { Doctor } from '../entities/doctor.entity';
import { User } from '../entities/user.entity';
import { Clinic } from '../entities/clinic.entity';
import { PatientProfile } from '../entities/patient-profile.entity';
import { Patient } from '../entities/patient.entity';
import { Appointment } from '../entities/appointment.entity';
import { IntakeTest } from '../entities/intake-test.entity';
import { DoctorReview } from '../entities/review.entity';
import { DoctorSpeciality } from '../entities/doctor-speciality.entity';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [
    SchedulesModule,
    UploadsModule,
    AiModule,
    TypeOrmModule.forFeature([
      Doctor,
      User,
      Clinic,
      PatientProfile,
      Patient,
      Appointment,
      IntakeTest,
      DoctorReview,
      DoctorSpeciality,
    ]),
  ],
  controllers: [PatientPortalController],
  providers: [PatientPortalService],
  exports: [PatientPortalService],
})
export class PatientPortalModule {}
