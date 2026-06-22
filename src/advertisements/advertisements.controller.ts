import { Controller, Get } from '@nestjs/common';
import { AdvertisementsService } from './advertisements.service';
import { Public } from '../auth/public.decorator';

@Controller('advertisements')
export class AdvertisementsController {
  constructor(private readonly service: AdvertisementsService) {}

  @Get()
  @Public()
  findAll() {
    return this.service.findAll();
  }
}
