import {
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import type {
  MessageAttachmentMeta,
  MessageType,
} from '../../entities/message.entity';

export class CreateMessageDto {
  @IsUUID()
  recipient_id: string;

  @IsOptional()
  @IsIn([
    'text',
    'image',
    'video',
    'voice',
    'medical_link',
    'access_action',
    'appointment_action',
  ])
  type?: MessageType;

  @ValidateIf((dto: CreateMessageDto) => (dto.type ?? 'text') === 'text')
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  content?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  attachment_url?: string;

  @IsOptional()
  @IsObject()
  attachment_meta?: MessageAttachmentMeta;
}
