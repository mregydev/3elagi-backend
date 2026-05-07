import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
} from '@nestjs/common';
import { AppointmentsService } from './appointments.service';
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
  findByClinicAndDate(
    @Param('clinicId') clinicId: string,
    @Query('date') date: string,
  ) {
    const d = date || new Date().toISOString().split('T')[0];
    return this.service.findByClinicAndDate(clinicId, d);
  }

  @Get('doctor/:doctorId/list')
  listForDoctor(@Param('doctorId') doctorId: string) {
    return this.service.listForDoctor(doctorId);
  }

  @Get('doctor/:doctorId/queue')
  getQueueForDoctor(@Param('doctorId') doctorId: string) {
    const today = new Date().toISOString().split('T')[0];
    return this.service.getQueueForDoctor(doctorId, today);
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.service.findById(id);
  }

  @Post()
  create(@Body() dto: CreateAppointmentDto) {
    return this.service.create(dto);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() body: { status: AppointmentStatus },
  ) {
    return this.service.updateStatus(id, body.status);
  }

  @Patch('doctor/:doctorId/call-next')
  callNextPatient(@Param('doctorId') doctorId: string) {
    return this.service.callNextPatient(doctorId);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
