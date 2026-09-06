import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IntakeExamAssignment } from '../entities/intake-exam-assignment.entity';
import { IntakeExamInstance } from '../entities/intake-exam-instance.entity';
import { IntakeTest } from '../entities/intake-test.entity';
import { Doctor } from '../entities/doctor.entity';
import { Diagnosis } from '../entities/diagnosis.entity';
import { DoctorPatientAccessModule } from '../doctor-patient-access/doctor-patient-access.module';
import { PresenceModule } from '../presence/presence.module';
import { PushNotificationsModule } from '../push-notifications/push-notifications.module';
import { IntakeExamsService } from './intake-exams.service';
import { IntakeExamsController } from './intake-exams.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      IntakeExamAssignment,
      IntakeExamInstance,
      IntakeTest,
      Doctor,
      Diagnosis,
    ]),
    DoctorPatientAccessModule,
    PresenceModule,
    PushNotificationsModule,
  ],
  providers: [IntakeExamsService],
  controllers: [IntakeExamsController],
  exports: [IntakeExamsService],
})
export class IntakeExamsModule {}
