import {
  Body,
  Controller,
  Post,
  Request,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { TtsDto } from './dto/tts.dto';
import { TtsService } from './tts.service';

@Controller('tts')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('patient', 'doctor', 'admin', 'clinic_admin')
export class TtsController {
  constructor(private readonly tts: TtsService) {}

  @Post()
  async speak(
    @Request() _req: { user: { id: string } },
    @Body() body: TtsDto,
    @Res() res: Response,
  ) {
    const audio = await this.tts.synthesize(body.text);
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'no-store');
    res.send(audio);
  }
}
