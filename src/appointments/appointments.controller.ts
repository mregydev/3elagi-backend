import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { AppointmentsService } from './appointments.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { AppointmentStatus } from '../entities/appointment.entity';

@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly service: AppointmentsService) {}

  @Get('clinic/:clinicId/screen')
  getClinicQueueScreen(@Param('clinicId') clinicId: string) {
    return this.service.getClinicQueueScreen(clinicId);
  }

  @Get('clinic/:clinicId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('clinic_admin')
  findByClinicAndDate(
    @Param('clinicId') clinicId: string,
    @Query('date') date: string,
    @Request() req,
  ) {
    const d = date || new Date().toISOString().split('T')[0];
    return this.service.findByClinicAndDate(clinicId, d, req.user.id);
  }

  @Get('doctor/:doctorId/list')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('doctor')
  listForDoctor(@Param('doctorId') doctorId: string, @Request() req) {
    return this.service.listForDoctor(doctorId, req.user.id);
  }

  @Get('doctor/:doctorId/queue')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('doctor')
  getQueueForDoctor(
    @Param('doctorId') doctorId: string,
    @Request() req,
  ) {
    // Queue is a live "today" view — always pinned to the server's current
    // date, regardless of any date query parameter sent by the client.
    const today = new Date().toISOString().split('T')[0];
    return this.service.getQueueForDoctor(doctorId, today, req.user.id);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  findById(@Param('id') id: string, @Request() req) {
    return this.service.findById(id, req.user.id, req.user.role);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('clinic_admin')
  create(@Body() dto: CreateAppointmentDto, @Request() req) {
    return this.service.create(dto, req.user.id);
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('clinic_admin')
  updateStatus(
    @Param('id') id: string,
    @Body() body: { status: AppointmentStatus },
    @Request() req,
  ) {
    return this.service.updateStatus(id, body.status, req.user.id);
  }

  @Patch('doctor/:doctorId/call-next')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('doctor')
  callNextPatient(@Param('doctorId') doctorId: string, @Request() req) {
    return this.service.callNextPatient(doctorId, req.user.id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('clinic_admin')
  remove(@Param('id') id: string, @Request() req) {
    return this.service.remove(id, req.user.id);
  }
}
