import { IsEmail, IsString, IsOptional } from 'class-validator';

export class RegisterClinicDto {
  @IsEmail()
  email: string;

  @IsString()
  password: string;

  @IsString()
  clinic_name: string;

  @IsString()
  clinic_phone: string;

  @IsString()
  clinic_location: string;

  @IsString()
  @IsOptional()
  permission_doc_url?: string;
}
