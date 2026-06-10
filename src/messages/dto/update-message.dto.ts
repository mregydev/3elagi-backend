import { IsObject, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import type { MedicalLinkMeta } from '../../entities/message.entity';

export class UpdateMessageDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  content?: string;

  @IsOptional()
  @IsObject()
  attachment_meta?: MedicalLinkMeta;
}
