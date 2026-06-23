import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ExpoPushMessage, ExpoPushTicket } from './expo-push.types';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

@Injectable()
export class ExpoPushClient {
  private readonly logger = new Logger(ExpoPushClient.name);

  constructor(private readonly config: ConfigService) {}

  async send(messages: ExpoPushMessage[]): Promise<string[]> {
    if (!messages.length) return [];

    const accessToken = this.config.get<string>('EXPO_ACCESS_TOKEN');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'Accept-encoding': 'gzip, deflate',
    };
    if (accessToken?.trim()) {
      headers.Authorization = `Bearer ${accessToken.trim()}`;
    }

    const invalid: string[] = [];

    for (const batch of chunk(messages, 100)) {
      try {
        const response = await fetch(EXPO_PUSH_URL, {
          method: 'POST',
          headers,
          body: JSON.stringify(batch),
        });

        if (!response.ok) {
          const text = await response.text();
          this.logger.warn(`Expo push HTTP ${response.status}: ${text}`);
          continue;
        }

        const json = (await response.json()) as { data?: ExpoPushTicket[] };
        const tickets = json.data ?? [];
        tickets.forEach((ticket, index) => {
          if (ticket.status === 'ok') return;
          const token = batch[index]?.to;
          const errorCode = ticket.details?.error;
          this.logger.warn(
            `Expo push error (${errorCode ?? 'unknown'}): ${ticket.message ?? ''}`,
          );
          if (
            token &&
            (errorCode === 'DeviceNotRegistered' ||
              errorCode === 'InvalidCredentials')
          ) {
            invalid.push(token);
          }
        });
      } catch (error) {
        this.logger.warn(
          `Expo push request failed: ${(error as Error).message}`,
        );
      }
    }

    return invalid;
  }
}
