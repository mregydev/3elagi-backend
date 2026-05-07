import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JoinRequestsController } from './join-requests.controller';
import { JoinRequestsService } from './join-requests.service';
import { ClinicJoinRequest } from '../entities/clinic-join-request.entity';
import { Doctor } from '../entities/doctor.entity';
@Module({
  imports: [TypeOrmModule.forFeature([ClinicJoinRequest, Doctor])],
  controllers: [JoinRequestsController],
  providers: [JoinRequestsService],
  exports: [JoinRequestsService],
})
export class JoinRequestsModule {}
