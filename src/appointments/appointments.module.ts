import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppointmentsController } from './appointments.controller';
import { AppointmentsService } from './appointments.service';
import { AppointmentsChatService } from './appointments-chat.service';
import { Appointment } from '../entities/appointment.entity';
import { Doctor } from '../entities/doctor.entity';
import { Patient } from '../entities/patient.entity';
import { Clinic } from '../entities/clinic.entity';
import { IntakeTest } from '../entities/intake-test.entity';
import { PatientProfile } from '../entities/patient-profile.entity';
import { Message } from '../entities/message.entity';
import { VideoCallSession } from '../entities/video-call-session.entity';
import { SchedulesModule } from '../schedules/schedules.module';
import { UsersModule } from '../users/users.module';
import { PresenceModule } from '../presence/presence.module';
import { PushNotificationsModule } from '../push-notifications/push-notifications.module';
import { WherebyModule } from '../whereby/whereby.module';

import { PointsModule } from '../points/points.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Appointment,
      Doctor,
      Patient,
      Clinic,
      IntakeTest,
      PatientProfile,
      Message,
      VideoCallSession,
    ]),
    SchedulesModule,
    UsersModule,
    PresenceModule,
    PushNotificationsModule,
    WherebyModule,
    PointsModule,
  ],
  controllers: [AppointmentsController],
  providers: [AppointmentsService, AppointmentsChatService],
  exports: [AppointmentsService, AppointmentsChatService],
})
export class AppointmentsModule {}
