import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { DiagnosisService } from './diagnosis.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CreateDiagnosisDto } from './dto/create-diagnosis.dto';
import { UpdateDiagnosisDto } from './dto/update-diagnosis.dto';
import { CompleteDiagnosisWithAiDto } from './dto/complete-diagnosis-with-ai.dto';

@Controller('diagnosis')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('doctor')
export class DiagnosisController {
  constructor(private readonly service: DiagnosisService) {}

  @Get()
  findAll(@Query('patient_id') patientId: string | undefined, @Request() req) {
    return this.service.findAll(patientId, req.user.id, req.user.role);
  }

  @Post('complete-with-ai')
  completeWithAi(@Body() dto: CompleteDiagnosisWithAiDto, @Request() req) {
    return this.service.completeWithAi(dto, req.user.id, req.user.role);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req) {
    return this.service.findOne(id, req.user.id, req.user.role);
  }

  @Post()
  create(@Body() dto: CreateDiagnosisDto, @Request() req) {
    return this.service.create(dto, req.user.id, req.user.role);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateDiagnosisDto,
    @Request() req,
  ) {
    return this.service.update(id, dto, req.user.id, req.user.role);
  }
}
