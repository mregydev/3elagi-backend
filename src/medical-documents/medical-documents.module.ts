import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MedicalDocumentsController } from './medical-documents.controller';
import { MedicalDocumentsService } from './medical-documents.service';
import { MedicalDocument } from '../entities/medical-document.entity';
import { Patient } from '../entities/patient.entity';
import { Doctor } from '../entities/doctor.entity';
import { Diagnosis } from '../entities/diagnosis.entity';
import { Symptom } from '../entities/symptom.entity';

@Module({
  imports: [TypeOrmModule.forFeature([MedicalDocument, Patient, Doctor, Diagnosis, Symptom])],
  controllers: [MedicalDocumentsController],
  providers: [MedicalDocumentsService],
  exports: [MedicalDocumentsService],
})
export class MedicalDocumentsModule {}
