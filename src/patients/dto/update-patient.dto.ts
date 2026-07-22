import { IsString, IsOptional, IsNumber, Validate } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { IsPatientCountryConstraint } from '../../common/is-patient-country.constraint';

export class UpdatePatientDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  birth_date?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @Validate(IsPatientCountryConstraint)
  country?: string;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  age?: number;

  @IsString()
  @IsOptional()
  photo_url?: string | null;
}
