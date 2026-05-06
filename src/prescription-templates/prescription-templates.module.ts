import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PrescriptionTemplate } from '../entities/prescription-template.entity';
import { Doctor } from '../entities/doctor.entity';
import { PrescriptionTemplatesService } from './prescription-templates.service';
import { PrescriptionTemplatesController } from './prescription-templates.controller';

@Module({
  imports: [TypeOrmModule.forFeature([PrescriptionTemplate, Doctor])],
  providers: [PrescriptionTemplatesService],
  controllers: [PrescriptionTemplatesController],
})
export class PrescriptionTemplatesModule {}
