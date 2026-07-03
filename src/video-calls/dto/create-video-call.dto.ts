import { IsUUID } from 'class-validator';

export class CreateVideoCallDto {
  @IsUUID()
  doctor_user_id: string;
}
