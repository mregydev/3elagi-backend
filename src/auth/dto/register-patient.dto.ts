import { Transform } from 'class-transformer';
import {
  Equals,
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  Validate,
} from 'class-validator';
import { IsPatientCountryConstraint } from '../../common/is-patient-country.constraint';

export class RegisterPatientDto {
  @IsEmail()
  email: string;

  @IsString()
  password: string;

  @IsString()
  name: string;

  @IsString()
  phone: string;

  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @Validate(IsPatientCountryConstraint)
  country: string;

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
