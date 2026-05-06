import { IsString, IsOptional } from 'class-validator';

export class CreateAppointmentDto {
  @IsString()
  clinic_id: string;

  @IsString()
  @IsOptional()
  doctor_id?: string;

  @IsString()
  @IsOptional()
  patient_id?: string;

  @IsString()
  @IsOptional()
  patient_name?: string;

  @IsString()
  patient_phone: string;

  @IsString()
  date: string;

  @IsString()
  @IsOptional()
  time?: string;
}
