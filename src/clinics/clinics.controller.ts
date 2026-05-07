import { Controller, Get, Post, Put, Param, Body } from '@nestjs/common';
import { ClinicsService } from './clinics.service';
import { Public } from '../auth/public.decorator';
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
  @Public()
  getDashboard(@Param('id') id: string) {
    return this.clinicsService.getDashboard(id);
  }

  @Post()
  @Public()
  create(@Body() dto: CreateClinicDto) {
    return this.clinicsService.create(dto);
  }

  @Put(':id')
  @Public()
  update(@Param('id') id: string, @Body() dto: Partial<CreateClinicDto>) {
    return this.clinicsService.update(id, dto);
  }
}
