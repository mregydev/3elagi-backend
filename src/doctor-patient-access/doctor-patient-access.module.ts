import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DoctorPatientAccess } from '../entities/doctor-patient-access.entity';
import { Doctor } from '../entities/doctor.entity';
import { PatientProfile } from '../entities/patient-profile.entity';
import { SpecialtyTestAccount } from '../entities/specialty-test-account.entity';
import { User } from '../entities/user.entity';
import { DoctorPatientAccessController } from './doctor-patient-access.controller';
import { DoctorPatientAccessService } from './doctor-patient-access.service';

@Module({
  imports: [TypeOrmModule.forFeature([DoctorPatientAccess, Doctor, User, PatientProfile, SpecialtyTestAccount])],
  controllers: [DoctorPatientAccessController],
  providers: [DoctorPatientAccessService],
  exports: [DoctorPatientAccessService],
})
export class DoctorPatientAccessModule {}
