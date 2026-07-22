import { Transform } from 'class-transformer';
import {
  Equals,
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
} from 'class-validator';
import { PATIENT_COUNTRY_CODES } from '../../common/patient-countries';

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
  @IsIn([...PATIENT_COUNTRY_CODES], {
    message: `country must be one of: ${PATIENT_COUNTRY_CODES.join(', ')}`,
  })
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
