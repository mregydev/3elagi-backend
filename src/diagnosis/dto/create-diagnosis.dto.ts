import { IsString, IsUUID } from 'class-validator';

export class CreateDiagnosisDto {
  @IsString()
  desc: string;

  @IsUUID()
  patient_id: string;

  @IsUUID()
  doctor_id: string;
}
