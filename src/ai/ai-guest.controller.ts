import { Body, Controller, Post } from '@nestjs/common';
import { Public } from '../auth/public.decorator';
import { AiChatService } from './ai-chat.service';

type GuestChatBody = {
  guestId?: string;
  message?: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  locale?: string;
  attachment?: { data: string; mimeType: string };
  fileName?: string;
};

/** Public AI endpoints for logged-out floating widget (capped turns). */
@Controller('ai/guest')
export class AiGuestController {
  constructor(private readonly aiChat: AiChatService) {}

  @Public()
  @Post('chat')
  chat(@Body() body: GuestChatBody) {
    return this.aiChat.guestChat({
      guestId: body?.guestId ?? '',
      message: body?.message ?? '',
      history: body?.history,
      locale: body?.locale,
      attachment: body?.attachment,
      fileName: body?.fileName,
    });
  }
}
