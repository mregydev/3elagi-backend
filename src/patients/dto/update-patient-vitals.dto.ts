import { Type } from 'class-transformer';
import { IsNumber, IsOptional, Max, Min } from 'class-validator';

export class UpdatePatientVitalsDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(50)
  @Max(280)
  blood_pressure_systolic?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(30)
  @Max(180)
  blood_pressure_diastolic?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(20)
  @Max(250)
  heart_rate_bpm?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(500)
  weight_kg?: number | null;
}
