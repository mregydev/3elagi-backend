import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppReview } from '../entities/app-review.entity';
import { User } from '../entities/user.entity';
import { Doctor } from '../entities/doctor.entity';
import { PatientProfile } from '../entities/patient-profile.entity';
import { AppReviewsController } from './app-reviews.controller';
import { AppReviewsService } from './app-reviews.service';

@Module({
  imports: [TypeOrmModule.forFeature([AppReview, User, Doctor, PatientProfile])],
  controllers: [AppReviewsController],
  providers: [AppReviewsService],
  exports: [AppReviewsService],
})
export class AppReviewsModule {}
