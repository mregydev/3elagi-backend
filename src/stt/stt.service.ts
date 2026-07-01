import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';

@Injectable()
export class SttService {
  private readonly logger = new Logger(SttService.name);
  private readonly modelName: string;

  constructor(private readonly config: ConfigService) {
    this.modelName =
      this.config.get<string>('GEMINI_STT_MODEL') ?? 'gemini-2.0-flash';
  }

  async transcribe(
    audio: Buffer,
    mimeType = 'audio/webm',
    languageCode?: string,
  ): Promise<string> {
    if (!audio.length) {
      throw new BadRequestException('Audio payload is empty');
    }

    const apiKey = this.config.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      throw new InternalServerErrorException('Speech recognition is not configured');
    }

    const langHint =
      languageCode === 'ar'
        ? 'The speaker is likely using Arabic.'
        : languageCode === 'en'
          ? 'The speaker is likely using English.'
          : 'The speaker may use Arabic or English.';

    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: this.modelName });
      const result = await model.generateContent([
        {
          inlineData: {
            mimeType,
            data: audio.toString('base64'),
          },
        },
        {
          text: `${langHint} Transcribe the spoken words in this audio. Reply with only the transcript — no labels, quotes, or commentary.`,
        },
      ]);

      const text = result.response.text()?.trim();
      if (!text) {
        throw new BadRequestException('No speech detected');
      }
      return text;
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      this.logger.error('STT failed', err);
      throw new InternalServerErrorException('Speech-to-text failed');
    }
  }
}
