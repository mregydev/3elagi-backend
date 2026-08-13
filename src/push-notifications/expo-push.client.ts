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

/**
 * Expo rejects the whole request when one batch mixes tokens from two projects
 * (`PUSH_TOO_MANY_EXPERIENCE_IDS`), so a single leftover token from a build of
 * an older Expo project silences the push for every other device. The error
 * lists the tokens per experience — return the ones that are not ours so the
 * caller can drop them and resend.
 */
export function foreignProjectTokens(
  responseBody: string,
  batchTokens: string[],
): string[] {
  let parsed: {
    errors?: { code?: string; details?: Record<string, string[]> }[];
  };
  try {
    parsed = JSON.parse(responseBody);
  } catch {
    return [];
  }
  const details = parsed.errors?.find(
    (e) => e.code === 'PUSH_TOO_MANY_EXPERIENCE_IDS',
  )?.details;
  if (!details) return [];

  const inBatch = new Set(batchTokens);
  return Object.entries(details)
    .filter(([experienceId]) => experienceId !== EXPO_PUSH_CONFIG.experienceId)
    .flatMap(([, tokens]) => tokens)
    .filter((token) => inBatch.has(token));
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
          const foreign = foreignProjectTokens(
            text,
            batch.map((m) => m.to),
          );
          if (foreign.length) {
            this.logger.warn(
              `Dropping ${foreign.length} token(s) from another Expo project and resending`,
            );
            invalid.push(...foreign);
            const keep = new Set(foreign);
            const retry = batch.filter((m) => !keep.has(m.to));
            // Only one experience is left now, so this cannot recurse again.
            if (retry.length) invalid.push(...(await this.send(retry)));
            continue;
          }
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
