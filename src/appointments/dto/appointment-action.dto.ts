import { IsIn, IsUUID } from 'class-validator';
import type { AppointmentActionType } from '../../entities/message.entity';

export class AppointmentActionDto {
  @IsUUID()
  appointment_id: string;

  @IsUUID()
  recipient_id: string;

  @IsIn(['confirm', 'reject', 'cancel'])
  action: Exclude<AppointmentActionType, 'request'>;
}
