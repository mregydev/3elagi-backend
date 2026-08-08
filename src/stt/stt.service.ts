import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';

/** Map client/container MIME types to ones Google AI Gemini accepts. */
function normalizeGeminiAudioMime(mimeType: string): string {
  const raw = (mimeType || '').trim().toLowerCase();
  if (
    raw === 'audio/mp4' ||
    raw === 'audio/m4a' ||
    raw === 'audio/x-m4a' ||
    raw === 'audio/aac' ||
    raw === 'audio/x-aac' ||
    raw === 'audio/3gpp' ||
    raw === 'audio/3gp'
  ) {
    return 'audio/aac';
  }
  if (raw === 'audio/mpeg' || raw === 'audio/mp3' || raw === 'audio/mpga') {
    return 'audio/mp3';
  }
  if (raw === 'audio/wave') return 'audio/wav';
  if (raw === 'audio/ogg' || raw === 'audio/opus') return 'audio/ogg';
  if (
    raw === 'audio/wav' ||
    raw === 'audio/webm' ||
    raw === 'audio/flac' ||
    raw === 'audio/aiff'
  ) {
    return raw;
  }
  // Unknown — try AAC (native mobile default) rather than failing on mp4.
  return raw || 'audio/aac';
}

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

    const normalizedMime = normalizeGeminiAudioMime(mimeType);

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

    const prompt = `${langHint}

Transcribe the spoken words in this audio accurately.
Reply with only the transcript — no labels, quotes, language names, or commentary.`;

    // Native recordings are AAC inside an MP4/3GP container; Gemini rejects one
    // label or the other depending on the file, so try the plausible ones.
    const candidates = [
      ...new Set([normalizedMime, mimeType.trim().toLowerCase(), 'audio/mp4']),
    ].filter(Boolean);

    let lastErr: unknown;
    for (const candidate of candidates) {
      try {
        const text = await this.runGemini(apiKey, audio, candidate, prompt);
        if (!text) throw new BadRequestException('No speech detected');
        return text;
      } catch (err) {
        if (err instanceof BadRequestException) throw err;
        lastErr = err;
        this.logger.warn(
          `STT attempt failed (mime=${mimeType} → ${candidate}): ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }

    this.logger.error(`STT failed (mime=${mimeType})`, lastErr);
    throw new InternalServerErrorException('Speech-to-text failed');
  }

  private async runGemini(
    apiKey: string,
    audio: Buffer,
    mimeType: string,
    prompt: string,
  ): Promise<string> {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: this.modelName });
    const result = await model.generateContent([
      { inlineData: { mimeType, data: audio.toString('base64') } },
      { text: prompt },
    ]);
    return result.response.text()?.trim() ?? '';
  }
}
