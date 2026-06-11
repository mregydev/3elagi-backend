import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Request,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AiService } from './ai.service';
import { AiChatDto } from './dto/chat.dto';

@Controller('ai')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('patient', 'doctor', 'admin', 'clinic_admin')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('chat')
  async chat(
    @Request() req: { user: { id: string; role: string } },
    @Body() dto: AiChatDto,
    @Res() res: Response,
  ) {
    if (dto.stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders?.();

      for await (const event of this.aiService.streamChat(
        req.user,
        dto.message,
        dto.conversationId,
        dto.patientUserId,
      )) {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      }
      res.end();
      return;
    }

    const result = await this.aiService.chat(
      req.user,
      dto.message,
      dto.conversationId,
      dto.patientUserId,
    );
    res.json(result);
  }

  @Get('history')
  listHistory(@Request() req: { user: { id: string } }) {
    return this.aiService.listHistory(req.user.id);
  }

  @Delete('history/:id')
  deleteHistory(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
  ) {
    return this.aiService.deleteConversation(req.user.id, id);
  }
}
