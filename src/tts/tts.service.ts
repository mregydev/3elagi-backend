import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import { detectMessageLanguage } from '../ai/utils/detect-message-language';

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
    const languageCode = lang === 'ar' ? 'ar-XA' : 'en-US';
    const voiceName =
      lang === 'ar' ? 'ar-XA-Wavenet-B' : 'en-US-Neural2-D';

    try {
      const [response] = await this.client.synthesizeSpeech({
        input: { text: trimmed },
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
