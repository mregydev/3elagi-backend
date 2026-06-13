import { Body, Controller, Delete, Post, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import {
  RemoveMessageEmotionDto,
  SetMessageEmotionDto,
} from './dto/set-message-emotion.dto';
import { MessageEmotionsService } from './message-emotions.service';

@Controller('message-emotions')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('doctor', 'patient')
export class MessageEmotionsController {
  constructor(private readonly emotions: MessageEmotionsService) {}

  @Post()
  set(
    @Request() req: { user: { id: string } },
    @Body() dto: SetMessageEmotionDto,
  ) {
    return this.emotions.setEmotion(
      req.user.id,
      dto.message_id,
      dto.message_source,
      dto.emotion,
    );
  }

  @Delete()
  remove(
    @Request() req: { user: { id: string } },
    @Body() dto: RemoveMessageEmotionDto,
  ) {
    return this.emotions.removeEmotion(
      req.user.id,
      dto.message_id,
      dto.message_source,
    );
  }
}
