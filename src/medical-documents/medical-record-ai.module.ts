import { Module } from '@nestjs/common';
import { MedicalRecordImageAnalyzerService } from './medical-record-image-analyzer.service';

@Module({
  providers: [MedicalRecordImageAnalyzerService],
  exports: [MedicalRecordImageAnalyzerService],
})
export class MedicalRecordAiModule {}
