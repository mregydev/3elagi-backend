import { IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';

export class ChatBookAppointmentDto {
  @IsUUID()
  doctor_user_id: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date: string;

  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  time: string;

  /** Patient's stated reason / status for the visit. */
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string;

  /** AI-written, doctor-facing insight shown in the appointment confirmation. */
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  patient_insight?: string;
}
