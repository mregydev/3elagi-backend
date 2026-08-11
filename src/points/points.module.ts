import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../entities/user.entity';
import { Doctor } from '../entities/doctor.entity';
import { PointPricing } from '../entities/point-pricing.entity';
import { PointPricingService } from './point-pricing.service';
import { PointsController } from './points.controller';
import { PointsService } from './points.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, Doctor, PointPricing])],
  controllers: [PointsController],
  providers: [PointsService, PointPricingService],
  exports: [PointsService, PointPricingService],
})
export class PointsModule {}
