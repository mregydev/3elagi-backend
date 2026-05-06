import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
  Query,
  Request,
  ForbiddenException,
} from '@nestjs/common';
import { JoinRequestsService } from './join-requests.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { JoinRequestStatus } from '../entities/clinic-join-request.entity';

@Controller('join-requests')
@UseGuards(JwtAuthGuard, RolesGuard)
export class JoinRequestsController {
  constructor(private readonly service: JoinRequestsService) {}

  @Post('request')
  @Roles('doctor')
  async requestToJoin(
    @Body() body: { clinic_id: string },
    @Request() req,
  ) {
    const doctorId = await this.service.getDoctorIdByUserId(req.user.id);
    if (!doctorId) {
      throw new ForbiddenException('Doctor profile not found');
    }
    return this.service.requestToJoin(doctorId, body.clinic_id);
  }

  @Get('clinic/:clinicId')
  @Roles('clinic_admin')
  findByClinic(
    @Param('clinicId') clinicId: string,
    @Query('status') status: string,
    @Request() req,
  ) {
    return this.service.findByClinicForAdmin(clinicId, req.user.id, status as JoinRequestStatus);
  }

  @Get('doctor/my')
  @Roles('doctor')
  findMine(@Request() req) {
    return this.service.findByUserId(req.user.id);
  }

  @Get('doctor/:doctorId')
  @Roles('clinic_admin')
  findByDoctor(@Param('doctorId') doctorId: string, @Request() req) {
    return this.service.findByDoctor(doctorId, req.user.id);
  }

  @Patch(':id/approve')
  @Roles('clinic_admin')
  approve(@Param('id') id: string, @Request() req) {
    return this.service.approve(id, req.user.id);
  }

  @Patch(':id/reject')
  @Roles('clinic_admin')
  reject(@Param('id') id: string, @Request() req) {
    return this.service.reject(id, req.user.id);
  }
}
