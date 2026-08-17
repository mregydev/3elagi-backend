import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { SpeechClient } from '@google-cloud/speech';

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
    raw === 'audio/aiff' ||
    raw === 'audio/x-caf'
  ) {
    return raw;
  }
  return raw || 'audio/aac';
}

function mimeCandidates(original: string, normalized: string): string[] {
  const raw = (original || '').trim().toLowerCase();
  return [
    ...new Set([
      normalized,
      raw,
      'audio/mp4',
      'audio/m4a',
      'audio/x-m4a',
      'audio/aac',
      'audio/wav',
      'audio/3gpp',
      'audio/webm',
    ]),
  ].filter(Boolean);
}

function geminiErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err ?? 'Unknown error');
}

@Injectable()
export class SttService {
  private readonly logger = new Logger(SttService.name);
  private readonly modelNames: string[];
  private readonly speechClient = new SpeechClient();

  constructor(private readonly config: ConfigService) {
    const primary =
      this.config.get<string>('GEMINI_STT_MODEL') ?? 'gemini-2.5-flash';
    this.modelNames = [
      primary,
      'gemini-2.0-flash',
      'gemini-1.5-flash',
    ].filter((name, index, all) => all.indexOf(name) === index);
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
    const normalizedMime = normalizeGeminiAudioMime(mimeType);
    const candidates = mimeCandidates(mimeType, normalizedMime);

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

    if (apiKey) {
      let lastGeminiErr: unknown;
      for (const candidate of candidates) {
        for (const modelName of this.modelNames) {
          try {
            const text = await this.runGemini(
              apiKey,
              modelName,
              audio,
              candidate,
              prompt,
            );
            if (!text) throw new BadRequestException('No speech detected');
            return text;
          } catch (err) {
            if (err instanceof BadRequestException) throw err;
            lastGeminiErr = err;
            this.logger.warn(
              `Gemini STT failed (model=${modelName}, mime=${mimeType} → ${candidate}): ${geminiErrorMessage(err)}`,
            );
          }
        }
      }
      this.logger.warn(
        `Gemini STT exhausted (mime=${mimeType}); trying Cloud Speech`,
        lastGeminiErr,
      );
    } else {
      this.logger.warn('GEMINI_API_KEY missing; using Cloud Speech STT only');
    }

    try {
      const text = await this.transcribeWithCloudSpeech(
        audio,
        languageCode,
      );
      if (!text) throw new BadRequestException('No speech detected');
      return text;
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      this.logger.error(`STT failed (mime=${mimeType})`, err);
      throw new InternalServerErrorException('Speech-to-text failed');
    }
  }

  private async runGemini(
    apiKey: string,
    modelName: string,
    audio: Buffer,
    mimeType: string,
    prompt: string,
  ): Promise<string> {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: modelName });
    const result = await model.generateContent([
      { inlineData: { mimeType, data: audio.toString('base64') } },
      { text: prompt },
    ]);
    return result.response.text()?.trim() ?? '';
  }

  private async transcribeWithCloudSpeech(
    audio: Buffer,
    languageCode?: string,
  ): Promise<string> {
    const normalizedLang = (languageCode ?? '').trim().toLowerCase();
    const primaryLang =
      normalizedLang === 'ar' || normalizedLang.startsWith('ar-')
        ? 'ar-EG'
        : normalizedLang === 'de' || normalizedLang.startsWith('de-')
          ? 'de-DE'
          : normalizedLang === 'es' || normalizedLang.startsWith('es-')
            ? 'es-ES'
            : normalizedLang === 'en' || normalizedLang.startsWith('en-')
              ? 'en-US'
              : 'en-US';

    const altLangs = ['ar-EG', 'en-US', 'de-DE', 'es-ES'].filter(
      (code) => code !== primaryLang,
    );

    const [response] = await this.speechClient.recognize({
      audio: { content: audio.toString('base64') },
      config: {
        encoding: 'ENCODING_UNSPECIFIED',
        languageCode: primaryLang,
        alternativeLanguageCodes: altLangs,
        enableAutomaticPunctuation: true,
        model: 'latest_long',
      },
    });

    const text = (response.results ?? [])
      .flatMap((result) => result.alternatives ?? [])
      .map((alt) => alt.transcript?.trim() ?? '')
      .filter(Boolean)
      .join(' ')
      .trim();

    return text;
  }
}
