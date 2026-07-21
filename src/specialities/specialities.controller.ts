import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { SpecialitiesService } from './specialities.service';
import { Public } from '../auth/public.decorator';
import { SPECIALITY_IMAGE_FILES } from '../constants/speciality-images';

@Controller('specialities')
export class SpecialitiesController {
  constructor(private readonly service: SpecialitiesService) {}

  @Get()
  @Public()
  findAll() {
    return this.service.findAll();
  }

  @Get('images/:filename')
  @Public()
  serveImage(@Param('filename') filename: string, @Res() res: Response) {
    const safeName = path.basename(filename);
    const allowed = Object.values(SPECIALITY_IMAGE_FILES);
    if (!allowed.includes(safeName)) {
      throw new NotFoundException('Image not found');
    }
    const filePath = path.join(
      process.cwd(),
      'assets',
      'specialities',
      safeName,
    );
    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('Image not found');
    }
    res.sendFile(filePath);
  }

  @Get(':id/doctors')
  @Public()
  findDoctors(
    @Param('id') id: string,
    @Query('country') country?: string,
  ) {
    return this.service.findDoctorsBySpeciality(id, country);
  }
}
