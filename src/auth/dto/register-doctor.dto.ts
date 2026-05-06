import { IsEmail, IsString, IsOptional, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class RegisterDoctorDto {
  @IsEmail()
  email: string;

  @IsString()
  password: string;

  @IsString()
  name: string;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  age?: number;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  photo_url?: string;

  @IsString()
  @IsOptional()
  graduation_cert_url?: string;

  @IsString()
  @IsOptional()
  work_permit_url?: string;
}
