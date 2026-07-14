import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { MEDICAL_BODY_PARTS } from '../../common/medical-body-part';
import { CreateDiagnosisSymptomDto } from './create-diagnosis-symptom.dto';

export class CreatePatientDiagnosisDto {
  @IsString()
  desc: string;

  @IsOptional()
  @IsIn([...MEDICAL_BODY_PARTS])
  body_part?: string | null;

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
