import { Body, Controller, Get, Param, Post, Request, UseGuards } from '@nestjs/common';
import { DiagnosisService } from './diagnosis.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CreatePatientDiagnosisDto } from './dto/create-patient-diagnosis.dto';
import { AddPatientSymptomDto } from './dto/add-patient-symptom.dto';

@Controller('patient/diagnoses')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('patient')
export class PatientDiagnosisController {
  constructor(private readonly service: DiagnosisService) {}

  @Get()
  findMine(@Request() req) {
    return this.service.findForPatientUser(req.user.id);
  }

  @Post()
  create(@Body() dto: CreatePatientDiagnosisDto, @Request() req) {
    return this.service.createForPatientUser(req.user.id, dto);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req) {
    return this.service.findOneForPatientUser(id, req.user.id);
  }

  @Post(':id/symptoms')
  addSymptom(
    @Param('id') id: string,
    @Body() dto: AddPatientSymptomDto,
    @Request() req,
  ) {
    return this.service.addSymptomForPatientUser(id, req.user.id, dto.desc);
  }
}
