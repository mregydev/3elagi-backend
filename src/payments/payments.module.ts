import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentIntention } from '../entities/payment-intention.entity';
import { PatientProfile } from '../entities/patient-profile.entity';
import { User } from '../entities/user.entity';
import { PointsModule } from '../points/points.module';
import { PaymobService } from './paymob.service';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

@Module({
  imports: [
    PointsModule,
    TypeOrmModule.forFeature([PaymentIntention, User, PatientProfile]),
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService, PaymobService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
