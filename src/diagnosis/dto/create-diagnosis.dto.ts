import { Type } from 'class-transformer';
import {
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { CreateDiagnosisSymptomDto } from './create-diagnosis-symptom.dto';

export class CreateDiagnosisDto {
  @IsString()
  desc: string;

  @IsUUID()
  patient_id: string;

  @IsUUID()
  doctor_id: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateDiagnosisSymptomDto)
  symptoms?: CreateDiagnosisSymptomDto[];

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  document_ids?: string[];
}
