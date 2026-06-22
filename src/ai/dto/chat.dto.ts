import { IsBoolean, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class AiChatDto {
  @IsString()
  @MaxLength(4000)
  message!: string;

  @IsOptional()
  @IsUUID()
  conversationId?: string;

  @IsOptional()
  @IsUUID()
  patientUserId?: string;

  @IsOptional()
  @IsBoolean()
  stream?: boolean;
}
