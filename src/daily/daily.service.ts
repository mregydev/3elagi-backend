import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { DAILY_CONFIG } from './daily.config';

interface DailyRoomResponse {
  url?: string;
  name?: string;
  error?: string;
  info?: string;
}

@Injectable()
export class DailyService {
  private readonly logger = new Logger(DailyService.name);

  /**
   * Creates a brand-new Daily room on every call, so each doctor↔patient call
   * gets its own isolated room (Daily auto-generates a unique room name).
   */
  async createRoom(): Promise<{ roomUrl: string; meetingId?: string }> {
    const apiKey = DAILY_CONFIG.apiKey;
    if (!apiKey) {
      this.logger.error('DAILY_API_KEY is not configured');
      throw new InternalServerErrorException('Video calls are not configured');
    }

    // Room auto-expires 2h after creation and ejects anyone still connected.
    const exp = Math.floor(Date.now() / 1000) + 2 * 60 * 60;

    let response: Response;
    try {
      response = await fetch(DAILY_CONFIG.apiUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          privacy: 'public',
          properties: {
            exp,
            eject_at_room_exp: true,
            enable_prejoin_ui: true,
          },
        }),
      });
    } catch (err) {
      this.logger.error('Daily API request failed', err);
      throw new InternalServerErrorException('Could not create video call');
    }

    const data = (await response.json().catch(() => ({}))) as DailyRoomResponse;

    if (!response.ok || !data.url) {
      this.logger.error(
        `Daily API HTTP ${response.status}: ${data.error ?? data.info ?? JSON.stringify(data)}`,
      );
      throw new InternalServerErrorException('Could not create video call');
    }

    return { roomUrl: data.url, meetingId: data.name };
  }
}
