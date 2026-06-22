import { Body, Controller, Get, Param, Post, Request, UseGuards } from '@nestjs/common';
import { DiagnosisService } from './diagnosis.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CreatePatientDiagnosisDto } from './dto/create-patient-diagnosis.dto';
import { AddPatientSymptomDto } from './dto/add-patient-symptom.dto';

@Controller('patient/diagnoses')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PatientDiagnosisController {
  constructor(private readonly service: DiagnosisService) {}

  @Get()
  @Roles('patient', 'doctor')
  findMine(@Request() req) {
    return this.service.findForPatientUser(req.user.id);
  }

  @Post()
  @Roles('patient', 'doctor')
  create(@Body() dto: CreatePatientDiagnosisDto, @Request() req) {
    return this.service.createForPatientUser(req.user.id, dto);
  }

  @Get(':id')
  @Roles('patient', 'doctor')
  findOne(@Param('id') id: string, @Request() req) {
    return this.service.findOneForPatientUser(id, req.user.id);
  }

  @Post(':id/symptoms')
  @Roles('patient', 'doctor')
  addSymptom(
    @Param('id') id: string,
    @Body() dto: AddPatientSymptomDto,
    @Request() req,
  ) {
    return this.service.addSymptomForPatientUser(id, req.user.id, dto.desc);
  }
}
