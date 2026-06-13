import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiConversation } from '../entities/ai-conversation.entity';
import { AiMessage } from '../entities/ai-message.entity';
import { Message } from '../entities/message.entity';
import { MessageEmotion } from '../entities/message-emotion.entity';
import { PresenceModule } from '../presence/presence.module';
import { MessageEmotionsController } from './message-emotions.controller';
import { MessageEmotionsService } from './message-emotions.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MessageEmotion,
      Message,
      AiMessage,
      AiConversation,
    ]),
    PresenceModule,
  ],
  controllers: [MessageEmotionsController],
  providers: [MessageEmotionsService],
  exports: [MessageEmotionsService],
})
export class MessageEmotionsModule {}
