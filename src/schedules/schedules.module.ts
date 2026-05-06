import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SchedulesController } from './schedules.controller';
import { SchedulesService } from './schedules.service';
import { DoctorSchedule } from '../entities/doctor-schedule.entity';
import { DoctorScheduleOverride } from '../entities/doctor-schedule-override.entity';
import { Doctor } from '../entities/doctor.entity';
import { Appointment } from '../entities/appointment.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      DoctorSchedule,
      DoctorScheduleOverride,
      Doctor,
      Appointment,
    ]),
  ],
  controllers: [SchedulesController],
  providers: [SchedulesService],
  exports: [SchedulesService],
})
export class SchedulesModule {}
