import {
  IsEmail,
  IsString,
  IsOptional,
  IsNumber,
  IsUUID,
  IsInt,
  Min,
  Max,
  IsIn,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { PATIENT_COUNTRY_CODES } from '../../common/patient-countries';

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

  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @IsIn([...PATIENT_COUNTRY_CODES], {
    message: `country must be one of: ${PATIENT_COUNTRY_CODES.join(', ')}`,
  })
  country: string;

  @IsString()
  @IsOptional()
  photo_url?: string;

  @IsString()
  @IsOptional()
  graduation_cert_url?: string;

  @IsString()
  @IsOptional()
  work_permit_url?: string;

  @IsUUID()
  speciality_id: string;

  @IsInt()
  @Min(1)
  @Max(100_000)
  @IsOptional()
  @Type(() => Number)
  consultation_price?: number;
}
