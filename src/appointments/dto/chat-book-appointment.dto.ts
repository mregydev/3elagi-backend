import { IsString, IsUUID, Matches } from 'class-validator';

export class ChatBookAppointmentDto {
  @IsUUID()
  doctor_user_id: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date: string;

  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  time: string;
}
