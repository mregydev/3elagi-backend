import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { DocumentType } from '../../entities/medical-document.entity';
import type { MedicalAiInsight } from '../../common/medical-ai-insight.types';

class MedicalAiInsightDto {
  @IsString()
  description!: string;

  @IsString()
  possible_diseases!: string;
}

const PATIENT_UPLOAD_TYPES = [DocumentType.LAB, DocumentType.XRAY] as const;
export type PatientUploadDocumentType = (typeof PATIENT_UPLOAD_TYPES)[number];

export class CreatePatientMedicalDocumentDto {
  @IsEnum(PATIENT_UPLOAD_TYPES)
  type: PatientUploadDocumentType;

  @IsString()
  file_url: string;

  @IsString()
  file_name: string;

  /** Main description shown in the app */
  @IsString()
  notes: string;

  @IsString()
  title: string;

  /** When set by a doctor, the record is stored on this patient's user id. */
  @IsOptional()
  @IsString()
  patient_user_id?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => MedicalAiInsightDto)
  ai_insight?: MedicalAiInsight;

  @IsOptional()
  @IsBoolean()
  generate_ai_insight?: boolean;

  @IsOptional()
  @IsIn(['ar', 'en'])
  lang?: 'ar' | 'en';
}
