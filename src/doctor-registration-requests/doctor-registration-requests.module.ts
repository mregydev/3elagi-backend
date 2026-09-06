import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DoctorRegistrationRequest } from '../entities/doctor-registration-request.entity';
import { DoctorSpeciality } from '../entities/doctor-speciality.entity';
import { UploadsModule } from '../uploads/uploads.module';
import { DoctorRegistrationRequestsController } from './doctor-registration-requests.controller';
import { DoctorRegistrationRequestsService } from './doctor-registration-requests.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([DoctorRegistrationRequest, DoctorSpeciality]),
    UploadsModule,
  ],
  controllers: [DoctorRegistrationRequestsController],
  providers: [DoctorRegistrationRequestsService],
  exports: [DoctorRegistrationRequestsService],
})
export class DoctorRegistrationRequestsModule {}
