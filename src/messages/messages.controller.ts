import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CreateMessageDto } from './dto/create-message.dto';
import { MessagesService } from './messages.service';

@Controller('messages')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('doctor', 'patient')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Get('conversations')
  listConversations(@Request() req: { user: { id: string } }) {
    return this.messagesService.listConversations(req.user.id);
  }

  @Get('with/:peerId')
  listWithPeer(
    @Request() req: { user: { id: string } },
    @Param('peerId') peerId: string,
  ) {
    return this.messagesService.listWithPeer(req.user.id, peerId);
  }

  @Post()
  create(
    @Request() req: { user: { id: string } },
    @Body() dto: CreateMessageDto,
  ) {
    return this.messagesService.create(req.user.id, dto);
  }

  @Post('with/:peerId/read')
  markRead(
    @Request() req: { user: { id: string } },
    @Param('peerId') peerId: string,
  ) {
    return this.messagesService.markRead(req.user.id, peerId);
  }
}
