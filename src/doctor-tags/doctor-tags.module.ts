import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DoctorTagCatalog } from '../entities/doctor-tag-catalog.entity';
import { DoctorTagsController } from './doctor-tags.controller';
import { DoctorTagsService } from './doctor-tags.service';

@Module({
  imports: [TypeOrmModule.forFeature([DoctorTagCatalog])],
  controllers: [DoctorTagsController],
  providers: [DoctorTagsService],
  exports: [DoctorTagsService],
})
export class DoctorTagsModule {}
