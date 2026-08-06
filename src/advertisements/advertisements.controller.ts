import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { AdvertisementsService } from './advertisements.service';
import { Public } from '../auth/public.decorator';
import { ADVERTISEMENT_ALLOWED_FILES } from '../constants/advertisement-images';

@Controller('advertisements')
export class AdvertisementsController {
  constructor(private readonly service: AdvertisementsService) {}

  @Get()
  @Public()
  findAll() {
    return this.service.findAll();
  }

  @Get('images/:filename')
  @Public()
  serveImage(@Param('filename') filename: string, @Res() res: Response) {
    const safeName = path.basename(filename);
    if (!ADVERTISEMENT_ALLOWED_FILES.includes(safeName)) {
      throw new NotFoundException('Image not found');
    }
    const filePath = path.join(
      process.cwd(),
      'assets',
      'advertisements',
      safeName,
    );
    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('Image not found');
    }
    res.sendFile(filePath);
  }
}
