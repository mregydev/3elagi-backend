import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { MEDICAL_BODY_PARTS } from '../../common/medical-body-part';
import {
  DiagnosisAssignIntakeExamDto,
  DiagnosisCreatePrescriptionDto,
} from '../../diagnosis/dto/create-diagnosis.dto';
import { CreateDiagnosisSymptomDto } from '../../diagnosis/dto/create-diagnosis-symptom.dto';

export class EndConsultationDiagnosisDto {
  @IsString()
  @MaxLength(4000)
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

  @IsOptional()
  @IsUUID()
  prescription_id?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => DiagnosisCreatePrescriptionDto)
  prescription?: DiagnosisCreatePrescriptionDto;

  @IsOptional()
  @IsUUID()
  intake_exam_assignment_id?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => DiagnosisAssignIntakeExamDto)
  intake_exam?: DiagnosisAssignIntakeExamDto;
}
