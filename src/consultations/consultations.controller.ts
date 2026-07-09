import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ConsultationsService } from './consultations.service';
import {
  CancelConsultationDto,
  EndConsultationDto,
  StartConsultationDto,
} from './dto/consultation.dto';

@Controller('consultations')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ConsultationsController {
  constructor(private readonly service: ConsultationsService) {}

  @Get('active')
  active(@Query('peer_id') peerId: string, @Request() req) {
    return this.service.findActiveWithPeer(req.user.id, peerId);
  }

  @Get('mine')
  mine(@Request() req) {
    const role = String(req.user.role ?? '').toLowerCase();
    if (role === 'doctor') {
      return this.service.listForDoctor(req.user.id);
    }
    if (role === 'patient') {
      return this.service.listForPatient(req.user.id);
    }
    throw new ForbiddenException('Not allowed');
  }

  @Post('start')
  @Roles('patient')
  start(@Body() dto: StartConsultationDto, @Request() req) {
    return this.service.start(req.user.id, dto);
  }

  @Post(':id/end')
  @Roles('doctor')
  end(
    @Param('id') id: string,
    @Body() dto: EndConsultationDto,
    @Request() req,
  ) {
    return this.service.end(req.user.id, id, dto);
  }

  @Post(':id/cancel')
  @Roles('doctor')
  cancel(
    @Param('id') id: string,
    @Body() dto: CancelConsultationDto,
    @Request() req,
  ) {
    return this.service.cancel(req.user.id, id, dto);
  }
}
