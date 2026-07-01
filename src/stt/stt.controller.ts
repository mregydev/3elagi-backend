import {
  Body,
  Controller,
  Post,
  Request,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { SttDto } from './dto/stt.dto';
import { SttService } from './stt.service';

@Controller('stt')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('patient', 'doctor', 'admin', 'clinic_admin')
export class SttController {
  constructor(private readonly stt: SttService) {}

  /** JSON body with base64 audio (mobile / fallback). */
  @Post()
  async transcribeJson(
    @Request() _req: { user: { id: string } },
    @Body() body: SttDto,
  ) {
    const buffer = Buffer.from(body.audio, 'base64');
    const text = await this.stt.transcribe(
      buffer,
      body.mimeType ?? 'audio/webm',
      body.languageCode,
    );
    return { text };
  }

  /** Multipart upload (web MediaRecorder). */
  @Post('upload')
  @UseInterceptors(
    FileInterceptor('audio', {
      storage: memoryStorage(),
      limits: { fileSize: 12 * 1024 * 1024 },
    }),
  )
  async transcribeUpload(
    @Request() _req: { user: { id: string } },
    @UploadedFile() file: Express.Multer.File,
    @Body('languageCode') languageCode?: string,
  ) {
    if (!file?.buffer?.length) {
      return { text: '' };
    }
    const text = await this.stt.transcribe(
      file.buffer,
      file.mimetype || 'audio/webm',
      languageCode,
    );
    return { text };
  }
}
