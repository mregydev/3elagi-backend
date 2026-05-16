import { IsOptional, IsString, IsUUID } from 'class-validator';

export class UpdateSymptomDto {
  @IsString()
  @IsOptional()
  desc?: string;

  @IsUUID()
  @IsOptional()
  diagnosis_id?: string;
}
