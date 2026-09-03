import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserLoginStat } from '../entities/user-login-stat.entity';
import { User } from '../entities/user.entity';
import { UserAnalyticsService } from './user-analytics.service';

@Module({
  imports: [TypeOrmModule.forFeature([UserLoginStat, User])],
  providers: [UserAnalyticsService],
  exports: [UserAnalyticsService],
})
export class AnalyticsModule {}
