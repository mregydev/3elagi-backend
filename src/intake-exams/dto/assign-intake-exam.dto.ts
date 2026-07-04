import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import type { IntakeExamRecurrence } from '../../entities/intake-exam-assignment.entity';

export class AssignIntakeExamDto {
  @IsUUID()
  patient_user_id: string;

  @IsUUID()
  intake_test_id: string;

  @IsString()
  deadline_at: string;

  @IsOptional()
  @IsIn(['none', 'daily', 'weekly', 'monthly', 'yearly'])
  recurrence_type?: IntakeExamRecurrence;

  @IsOptional()
  @IsInt()
  @Min(1)
  recurrence_interval?: number;
}
