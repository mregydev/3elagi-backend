import { IsArray, IsOptional, IsString, IsUUID } from 'class-validator';

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

  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  document_ids?: string[];
}
