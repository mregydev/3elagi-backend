import { Injectable, Logger } from '@nestjs/common';
import { ONESIGNAL_CONFIG } from './onesignal.config';

export interface OneSignalPushPayload {
  externalUserIds: string[];
  title: string;
  body: string;
  data: Record<string, string>;
}

@Injectable()
export class OneSignalPushClient {
  private readonly logger = new Logger(OneSignalPushClient.name);

  async send(payload: OneSignalPushPayload): Promise<void> {
    const { restApiKey, appId, apiUrl } = ONESIGNAL_CONFIG;
    if (!restApiKey.trim()) {
      this.logger.error(
        'OneSignal REST API key missing — set restApiKey in onesignal.config.ts',
      );
      return;
    }

    if (!payload.externalUserIds.length) return;

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Key ${restApiKey.trim()}`,
        },
        body: JSON.stringify({
          app_id: appId,
          include_aliases: {
            external_id: payload.externalUserIds,
          },
          target_channel: 'push',
          headings: { en: payload.title },
          contents: { en: payload.body },
          data: payload.data,
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        this.logger.error(`OneSignal push HTTP ${response.status}: ${text}`);
        return;
      }

      const json = (await response.json()) as { id?: string; errors?: string[] };
      if (json.errors?.length) {
        this.logger.error(`OneSignal push errors: ${json.errors.join(', ')}`);
        return;
      }

      this.logger.log(
        `OneSignal push sent to ${payload.externalUserIds.join(', ')} (id=${json.id ?? 'n/a'})`,
      );
    } catch (error) {
      this.logger.error(
        `OneSignal push request failed: ${(error as Error).message}`,
      );
    }
  }
}
