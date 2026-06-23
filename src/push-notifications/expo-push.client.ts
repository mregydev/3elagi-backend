import { Injectable, Logger } from '@nestjs/common';
import { EXPO_PUSH_CONFIG } from './expo-push.config';
import type { ExpoPushMessage, ExpoPushTicket } from './expo-push.types';

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

  async send(messages: ExpoPushMessage[]): Promise<string[]> {
    if (!messages.length) return [];

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'Accept-encoding': 'gzip, deflate',
    };

    const invalid: string[] = [];

    for (const batch of chunk(messages, 100)) {
      try {
        const response = await fetch(EXPO_PUSH_CONFIG.apiUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify(batch),
        });

        if (!response.ok) {
          const text = await response.text();
          this.logger.error(`Expo push HTTP ${response.status}: ${text}`);
          continue;
        }

        const json = (await response.json()) as { data?: ExpoPushTicket[] };
        const tickets = json.data ?? [];
        tickets.forEach((ticket, index) => {
          if (ticket.status === 'ok') return;
          const token = batch[index]?.to;
          const errorCode = ticket.details?.error;
          this.logger.error(
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
        this.logger.error(
          `Expo push request failed: ${(error as Error).message}`,
        );
      }
    }

    return invalid;
  }
}
