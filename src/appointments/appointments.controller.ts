import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AppointmentsService } from './appointments.service';
import { AppointmentsChatService } from './appointments-chat.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { ChatBookAppointmentDto } from './dto/chat-book-appointment.dto';
import { AppointmentActionDto } from './dto/appointment-action.dto';
import { AppointmentStatus } from '../entities/appointment.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Public } from '../auth/public.decorator';

@Controller('appointments')
export class AppointmentsController {
  constructor(
    private readonly service: AppointmentsService,
    private readonly chatService: AppointmentsChatService,
  ) {}

  @Get('my')
  @UseGuards(JwtAuthGuard)
  listMy(@Request() req: { user: { id: string; role: string } }) {
    return this.service.listUpcomingForUser(req.user.id, req.user.role);
  }

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

  @Post('chat-book')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('patient')
  chatBook(
    @Request() req: { user: { id: string } },
    @Body() dto: ChatBookAppointmentDto,
  ) {
    return this.chatService.bookFromChat(
      req.user.id,
      dto.doctor_user_id,
      dto.date,
      dto.time,
      dto.reason,
      dto.patient_insight,
    );
  }

  @Post('reminders/check')
  @Public()
  checkDueReminders() {
    return this.chatService.sendDueReminders();
  }

  @Post('chat-action')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('doctor', 'patient')
  chatAction(
    @Request() req: { user: { id: string } },
    @Body() dto: AppointmentActionDto,
  ) {
    return this.chatService.handleAction(req.user.id, dto.recipient_id, {
      appointment_id: dto.appointment_id,
      action: dto.action,
      date: '',
      time: '',
    });
  }

  @Post(':id/cancel')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('doctor', 'patient')
  cancelFromList(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
  ) {
    return this.chatService.cancelFromList(req.user.id, id);
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
