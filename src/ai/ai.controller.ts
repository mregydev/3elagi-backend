import {
  Controller,
  Delete,
  Get,
  GoneException,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AiChatService } from './ai-chat.service';

/** History endpoints remain for bootstrap; chat uses Socket.io (ai:message:send). */
@Controller('ai')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('patient', 'doctor', 'admin', 'clinic_admin')
export class AiController {
  constructor(private readonly aiChat: AiChatService) {}

  @Post('chat')
  chatDeprecated(): never {
    throw new GoneException(
      'AI chat moved to Socket.io. Emit ai:message:send on the websocket connection.',
    );
  }

  @Get('history')
  listHistory(@Request() req: { user: { id: string } }) {
    return this.aiChat.listHistory(req.user.id);
  }

  @Delete('history/:id')
  deleteHistory(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
  ) {
    return this.aiChat.deleteConversation(req.user.id, id);
  }
}
