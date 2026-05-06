import { IsString, IsOptional, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class CreatePatientDto {
  @IsString()
  clinic_id: string;

  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  birth_date?: string;

  @IsString()
  phone: string;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  age?: number;
}
