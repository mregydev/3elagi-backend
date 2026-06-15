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
import {
  CreatePrescriptionForUserDto,
  PrescriptionsService,
} from './prescriptions.service';
import { PrescriptionItem } from '../entities/prescription.entity';

@Controller('prescriptions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PrescriptionsController {
  constructor(private readonly service: PrescriptionsService) {}

  @Get('patient/:patientId')
  list(@Param('patientId') patientId: string, @Request() req) {
    return this.service.listForPatient(patientId, req.user.id, req.user.role);
  }

  @Get('patient-user/:patientUserId')
  listForPatientUser(@Param('patientUserId') patientUserId: string, @Request() req) {
    return this.service.listForPatientUser(
      patientUserId,
      req.user.id,
      req.user.role,
    );
  }

  @Get('patient-user/:patientUserId/:id')
  findOneForPatientUser(
    @Param('patientUserId') patientUserId: string,
    @Param('id') id: string,
    @Request() req,
  ) {
    return this.service.findOneForPatientUser(id, req.user.id, req.user.role);
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

  @Post('analyze-image')
  @Roles('doctor', 'patient')
  analyzeImage(
    @Body() body: { image_base64?: string; mime_type?: string },
  ) {
    return this.service.analyzeImage(
      body.image_base64 ?? '',
      body.mime_type ?? 'image/jpeg',
    );
  }

  @Post('patient-user')
  @Roles('doctor', 'patient')
  createForPatientUser(@Body() body: CreatePrescriptionForUserDto, @Request() req) {
    return this.service.createForPatientUser(body, req.user.id, req.user.role);
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
