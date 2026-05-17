import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { User } from '../entities/user.entity';
import { Doctor } from '../entities/doctor.entity';
import { PatientProfile } from '../entities/patient-profile.entity';
import { Patient } from '../entities/patient.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, Doctor, PatientProfile, Patient])],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
