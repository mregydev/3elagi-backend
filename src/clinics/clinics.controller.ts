import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ClinicsService } from './clinics.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CreateClinicDto } from './dto/create-clinic.dto';

@Controller('clinics')
export class ClinicsController {
  constructor(private readonly clinicsService: ClinicsService) {}

  @Get()
  findAll() {
    return this.clinicsService.findAll();
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.clinicsService.findById(id);
  }

  @Get(':id/dashboard')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('clinic_admin')
  getDashboard(@Param('id') id: string, @Request() req) {
    return this.clinicsService.getDashboard(id, req.user.id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('clinic_admin')
  create(@Body() dto: CreateClinicDto, @Request() req) {
    return this.clinicsService.create(dto, req.user.id);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('clinic_admin')
  update(@Param('id') id: string, @Body() dto: Partial<CreateClinicDto>, @Request() req) {
    return this.clinicsService.update(id, dto, req.user.id);
  }
}
