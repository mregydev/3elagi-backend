import { IsOptional, IsUUID } from 'class-validator';

export class CreateWherebyMeetingDto {
  /** Doctor user id for patient-initiated calls (validated when provided). */
  @IsOptional()
  @IsUUID()
  doctor_user_id?: string;
}
