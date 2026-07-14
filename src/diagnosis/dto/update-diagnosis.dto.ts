import { IsArray, IsIn, IsOptional, IsString, IsUUID } from 'class-validator';
import { MEDICAL_BODY_PARTS } from '../../common/medical-body-part';

export class UpdateDiagnosisDto {
  @IsString()
  @IsOptional()
  desc?: string;

  @IsUUID()
  @IsOptional()
  patient_id?: string;

  @IsUUID()
  @IsOptional()
  doctor_id?: string;

  @IsOptional()
  @IsIn([...MEDICAL_BODY_PARTS])
  body_part?: string | null;

  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  document_ids?: string[];
}
