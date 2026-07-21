import { IsString, IsOptional, IsNumber, IsIn } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { MARKET_COUNTRY_CODES } from '../../common/patient-countries';

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
  @IsIn([...MARKET_COUNTRY_CODES], {
    message: `country must be one of: ${MARKET_COUNTRY_CODES.join(', ')}`,
  })
  country?: string;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  age?: number;

  @IsString()
  @IsOptional()
  photo_url?: string | null;
}
