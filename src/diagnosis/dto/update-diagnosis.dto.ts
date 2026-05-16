import { IsOptional, IsString, IsUUID } from 'class-validator';

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
}
