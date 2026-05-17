import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { PatientsService } from './patients.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Public } from '../auth/public.decorator';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';

@Controller('patients')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PatientsController {
  constructor(private readonly patientsService: PatientsService) {}

  @Get('lookup')
  lookup(
    @Query('phone') phone: string,
    @Query('clinic_id') clinicId: string,
    @Request() req,
  ) {
    return this.patientsService.findByPhone(phone, clinicId, req.user.id, req.user.role);
  }

  @Get('clinic/:clinicId')
  @Public()
  findByClinic(@Param('clinicId') clinicId: string) {
    return this.patientsService.findByClinic(clinicId);
  }

  @Get()
  @Roles('doctor', 'admin')
  findAll() {
    return this.patientsService.findAll();
  }

  @Get(':id')
  findById(@Param('id') id: string, @Request() req) {
    return this.patientsService.findByIdWithDocuments(id, req.user.id, req.user.role);
  }

  @Get(':id/intake-history')
  getIntakeHistory(@Param('id') id: string, @Request() req) {
    return this.patientsService.getIntakeHistory(id, req.user.id, req.user.role);
  }

  @Get('by-doctor/:doctorId')
  @Roles('doctor')
  getDoctorPatients(@Param('doctorId') doctorId: string, @Request() req) {
    return this.patientsService.getDoctorPatients(doctorId, req.user.id);
  }

  @Post()
  @Public()
  create(@Body() dto: CreatePatientDto) {
    return this.patientsService.create(dto);
  }

  @Put(':id')
  @Public()
  update(@Param('id') id: string, @Body() dto: UpdatePatientDto) {
    return this.patientsService.update(id, dto);
  }

  @Patch(':id')
  @Public()
  patch(@Param('id') id: string, @Body() dto: UpdatePatientDto) {
    return this.patientsService.update(id, dto);
  }
}

@Controller('patient')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('patient')
export class PatientSelfController {
  constructor(private readonly patientsService: PatientsService) {}

  @Patch()
  updateMe(@Body() dto: UpdatePatientDto, @Request() req) {
    return this.patientsService.updateSelf(req.user.id, dto);
  }
}
