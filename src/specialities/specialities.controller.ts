import { Controller, Get, Param } from '@nestjs/common';
import { SpecialitiesService } from './specialities.service';
import { Public } from '../auth/public.decorator';

@Controller('specialities')
export class SpecialitiesController {
  constructor(private readonly service: SpecialitiesService) {}

  @Get()
  @Public()
  findAll() {
    return this.service.findAll();
  }

  @Get(':id/doctors')
  @Public()
  findDoctors(@Param('id') id: string) {
    return this.service.findDoctorsBySpeciality(id);
  }
}
