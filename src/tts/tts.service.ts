import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import { detectMessageLanguage } from '../ai/utils/detect-message-language';

const GEMINI_TTS_MODEL =
  process.env.TTS_GEMINI_MODEL ?? 'gemini-2.5-flash-tts';
const AR_EG_VOICE = 'Kore';
const AR_EG_PROMPT =
  'Speak in natural Egyptian Arabic (اللهجة المصرية) with a warm, conversational tone.';

@Injectable()
export class TtsService {
  private readonly logger = new Logger(TtsService.name);
  private readonly client = new TextToSpeechClient();

  async synthesize(text: string): Promise<Buffer> {
    const trimmed = text.trim();
    if (!trimmed) {
      throw new InternalServerErrorException('TTS text is empty');
    }

    const lang = detectMessageLanguage(trimmed);
    if (lang === 'ar') {
      try {
        return await this.synthesizeGemini({
          text: trimmed,
          languageCode: 'ar-EG',
          voiceName: AR_EG_VOICE,
          prompt: AR_EG_PROMPT,
        });
      } catch (err) {
        this.logger.warn(
          'Gemini Egyptian Arabic TTS failed; falling back to ar-XA',
          err,
        );
        return this.synthesizeLegacy(trimmed, 'ar-XA', 'ar-XA-Wavenet-B');
      }
    }

    return this.synthesizeLegacy(trimmed, 'en-US', 'en-US-Neural2-D');
  }

  private async synthesizeGemini(input: {
    text: string;
    languageCode: string;
    voiceName: string;
    prompt: string;
  }): Promise<Buffer> {
    const [response] = await this.client.synthesizeSpeech({
      input: { text: input.text, prompt: input.prompt },
      voice: {
        languageCode: input.languageCode,
        name: input.voiceName,
        modelName: GEMINI_TTS_MODEL,
      },
      audioConfig: { audioEncoding: 'MP3', speakingRate: 1.0 },
    });

    if (!response.audioContent) {
      throw new InternalServerErrorException('TTS returned no audio');
    }

    return Buffer.from(response.audioContent as Uint8Array);
  }

  private async synthesizeLegacy(
    text: string,
    languageCode: string,
    voiceName: string,
  ): Promise<Buffer> {
    try {
      const [response] = await this.client.synthesizeSpeech({
        input: { text },
        voice: { languageCode, name: voiceName },
        audioConfig: { audioEncoding: 'MP3', speakingRate: 1.0 },
      });

      if (!response.audioContent) {
        throw new InternalServerErrorException('TTS returned no audio');
      }

      return Buffer.from(response.audioContent as Uint8Array);
    } catch (err) {
      this.logger.error('Google TTS failed', err);
      throw new InternalServerErrorException('Text-to-speech failed');
    }
  }
}
