import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { MEDICAL_BODY_PARTS } from '../../common/medical-body-part';
import { CreateDiagnosisSymptomDto } from './create-diagnosis-symptom.dto';

export class DiagnosisPrescriptionMedicationDto {
  @IsString()
  medication_name: string;

  @IsOptional()
  @IsString()
  dose?: string;

  @IsOptional()
  @IsString()
  interval?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

/** Create a new prescription and link it to this diagnosis. */
export class DiagnosisCreatePrescriptionDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  symptoms?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DiagnosisPrescriptionMedicationDto)
  medications: DiagnosisPrescriptionMedicationDto[];

  @IsOptional()
  @IsIn([...MEDICAL_BODY_PARTS])
  body_part?: string | null;
}

/** Assign a new intake exam and link it to this diagnosis. */
export class DiagnosisAssignIntakeExamDto {
  @IsUUID()
  intake_test_id: string;

  @IsString()
  deadline_at: string;

  @IsOptional()
  @IsIn(['none', 'daily', 'weekly', 'monthly', 'yearly'])
  recurrence_type?: 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';

  @IsOptional()
  @IsInt()
  @Min(1)
  recurrence_interval?: number;
}

export class CreateDiagnosisDto {
  @IsString()
  desc: string;

  @IsUUID()
  patient_id: string;

  @IsUUID()
  doctor_id: string;

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

  /** Attach an existing prescription belonging to this patient. */
  @IsOptional()
  @IsUUID()
  prescription_id?: string;

  /** Create a new prescription and attach it. */
  @IsOptional()
  @ValidateNested()
  @Type(() => DiagnosisCreatePrescriptionDto)
  prescription?: DiagnosisCreatePrescriptionDto;

  /** Attach an existing intake exam assignment for this patient. */
  @IsOptional()
  @IsUUID()
  intake_exam_assignment_id?: string;

  /** Assign a new intake exam and attach it. */
  @IsOptional()
  @ValidateNested()
  @Type(() => DiagnosisAssignIntakeExamDto)
  intake_exam?: DiagnosisAssignIntakeExamDto;
}
