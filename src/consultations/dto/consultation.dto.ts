import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import type { ConsultationCancelReasonType } from '../../entities/consultation.entity';

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
}

export class CancelConsultationDto {
  @IsIn(['video_consultation', 'onsite_visit', 'other'])
  reason_type: ConsultationCancelReasonType;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string;
}
