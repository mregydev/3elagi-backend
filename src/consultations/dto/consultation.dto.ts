import { IsIn, IsOptional, IsString, IsUUID, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import type { ConsultationCancelReasonType } from '../../entities/consultation.entity';
import { EndConsultationDiagnosisDto } from './end-consultation-diagnosis.dto';

export class StartConsultationDto {
  @IsUUID()
  doctor_id: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;
}

export class EndConsultationDto {
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  note?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  diagnosis?: string;

  /** Full diagnosis payload (description, symptoms, linked lab/x-ray). */
  @IsOptional()
  @ValidateNested()
  @Type(() => EndConsultationDiagnosisDto)
  diagnosis_details?: EndConsultationDiagnosisDto;
}

export class CancelConsultationDto {
  @IsIn(['video_consultation', 'onsite_visit', 'other'])
  reason_type: ConsultationCancelReasonType;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string;
}
