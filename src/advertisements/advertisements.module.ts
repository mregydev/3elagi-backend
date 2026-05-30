import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdvertisementsController } from './advertisements.controller';
import { AdvertisementsService } from './advertisements.service';
import { Advertisement } from '../entities/advertisement.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Advertisement])],
  controllers: [AdvertisementsController],
  providers: [AdvertisementsService],
  exports: [AdvertisementsService],
})
export class AdvertisementsModule {}
