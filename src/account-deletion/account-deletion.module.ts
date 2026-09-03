import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountDeletionService } from './account-deletion.service';
import { User } from '../entities/user.entity';
import { Doctor } from '../entities/doctor.entity';
import { PatientProfile } from '../entities/patient-profile.entity';
import { DeletedAccount } from '../entities/deleted-account.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Doctor, PatientProfile, DeletedAccount]),
  ],
  providers: [AccountDeletionService],
  exports: [AccountDeletionService],
})
export class AccountDeletionModule {}
