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
import { SymptomsService } from './symptoms.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CreateSymptomDto } from './dto/create-symptom.dto';
import { UpdateSymptomDto } from './dto/update-symptom.dto';

@Controller('symptoms')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('doctor')
export class SymptomsController {
  constructor(private readonly service: SymptomsService) {}

  @Get()
  findAll(@Query('diagnosis_id') diagnosisId: string | undefined, @Request() req) {
    return this.service.findAll(diagnosisId, req.user.id, req.user.role);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req) {
    return this.service.findOne(id, req.user.id, req.user.role);
  }

  @Post()
  create(@Body() dto: CreateSymptomDto, @Request() req) {
    return this.service.create(dto, req.user.id, req.user.role);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateSymptomDto,
    @Request() req,
  ) {
    return this.service.update(id, dto, req.user.id, req.user.role);
  }
}
