import { Transform } from 'class-transformer';
import { Equals, IsBoolean, IsEmail, IsOptional, IsString } from 'class-validator';

export class RegisterPatientDto {
  @IsEmail()
  email: string;

  @IsString()
  password: string;

  @IsString()
  name: string;

  @IsString()
  phone: string;

  @IsOptional()
  @IsString()
  photo_url?: string;

  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  @Equals(true, {
    message: 'medical_records_storage_consent must be true',
  })
  medical_records_storage_consent: boolean;
}
