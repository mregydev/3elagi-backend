import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { User } from '../entities/user.entity';
import { Doctor } from '../entities/doctor.entity';
import { PatientProfile } from '../entities/patient-profile.entity';
import { Patient } from '../entities/patient.entity';
import { DoctorReview } from '../entities/review.entity';
import { PushNotificationsModule } from '../push-notifications/push-notifications.module';
import { AccountDeletionModule } from '../account-deletion/account-deletion.module';
import { AnalyticsModule } from '../analytics/analytics.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Doctor, PatientProfile, Patient, DoctorReview]),
    PushNotificationsModule,
    AccountDeletionModule,
    AnalyticsModule,
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
