import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { PrescriptionsService } from './prescriptions.service';
import { PrescriptionItem } from '../entities/prescription.entity';

@Controller('prescriptions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PrescriptionsController {
  constructor(private readonly service: PrescriptionsService) {}

  @Get('patient/:patientId')
  list(@Param('patientId') patientId: string, @Request() req) {
    return this.service.listForPatient(patientId, req.user.id, req.user.role);
  }

  @Get('template')
  @Roles('doctor')
  template(@Query('title') title: string, @Request() req) {
    return this.service.getTemplate(title, req.user.id);
  }

  @Get('diseases')
  @Roles('doctor')
  diseases(@Query('q') q: string, @Request() req) {
    return this.service.searchDiseases(q ?? '', req.user.id);
  }

  @Post()
  @Roles('doctor')
  create(
    @Body()
    body: {
      patient_id: string;
      title: string;
      symptoms?: string;
      items: PrescriptionItem[];
      lang?: 'ar' | 'en';
    },
    @Request() req,
  ) {
    return this.service.create(body, req.user.id);
  }
}
