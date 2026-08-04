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

    const normalizedLang = (languageCode ?? '').trim().toLowerCase();
    const autoDetect =
      !normalizedLang ||
      normalizedLang === 'auto' ||
      normalizedLang === 'und' ||
      normalizedLang === 'multi';

    const langHint = autoDetect
      ? `Detect the spoken language automatically among Arabic, English, German, and Spanish (the speaker may switch or mix them). Transcribe in the same language(s) spoken — keep Arabic script for Arabic, Latin script for English/German/Spanish.`
      : normalizedLang === 'ar' || normalizedLang.startsWith('ar-')
        ? 'The speaker is likely using Arabic. Prefer Arabic script.'
        : normalizedLang === 'de' || normalizedLang.startsWith('de-')
          ? 'The speaker is likely using German.'
          : normalizedLang === 'es' || normalizedLang.startsWith('es-')
            ? 'The speaker is likely using Spanish.'
            : normalizedLang === 'en' || normalizedLang.startsWith('en-')
              ? 'The speaker is likely using English.'
              : `Detect the spoken language automatically among Arabic, English, German, and Spanish. Transcribe in the same language spoken.`;

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
          text: `${langHint}

Transcribe the spoken words in this audio accurately.
Reply with only the transcript — no labels, quotes, language names, or commentary.`,
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
