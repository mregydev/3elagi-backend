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
import { Public } from '../auth/public.decorator';
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
  @Public()
  findByClinic(
    @Param('clinicId') clinicId: string,
    @Query('status') status: string,
  ) {
    return this.service.findByClinic(clinicId, status as JoinRequestStatus);
  }

  @Get('doctor/my')
  @Roles('doctor')
  findMine(@Request() req) {
    return this.service.findByUserId(req.user.id);
  }

  @Get('doctor/:doctorId')
  @Public()
  findByDoctor(@Param('doctorId') doctorId: string) {
    return this.service.findByDoctor(doctorId);
  }

  @Patch(':id/approve')
  @Public()
  approve(@Param('id') id: string) {
    return this.service.approve(id);
  }

  @Patch(':id/reject')
  @Public()
  reject(@Param('id') id: string) {
    return this.service.reject(id);
  }
}
