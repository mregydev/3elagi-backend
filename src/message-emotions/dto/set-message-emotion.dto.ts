import { IsIn, IsUUID } from 'class-validator';
import type {
  MessageEmotionSource,
  MessageEmotionType,
} from '../../entities/message-emotion.entity';

export class SetMessageEmotionDto {
  @IsUUID()
  message_id: string;

  @IsIn(['chat', 'ai'])
  message_source: MessageEmotionSource;

  @IsIn(['love', 'like', 'laugh', 'thumbsup'])
  emotion: MessageEmotionType;
}

export class RemoveMessageEmotionDto {
  @IsUUID()
  message_id: string;

  @IsIn(['chat', 'ai'])
  message_source: MessageEmotionSource;
}
