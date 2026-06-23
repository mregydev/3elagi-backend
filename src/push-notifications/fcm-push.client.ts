import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';
import type { PushNotificationType } from './expo-push.types';

const CHAT_CHANNEL_ID = 'chat-messages';

export interface FcmPushPayload {
  token: string;
  title: string;
  body: string;
  data: {
    chatId: string;
    messageId: string;
    type: PushNotificationType;
    senderId?: string;
  };
}

@Injectable()
export class FcmPushClient {
  private readonly logger = new Logger(FcmPushClient.name);
  private readonly ready: boolean;

  constructor(private readonly config: ConfigService) {
    this.ready = this.initFirebaseAdmin();
  }

  private initFirebaseAdmin(): boolean {
    if (admin.apps.length > 0) return true;

    const json = this.config.get<string>('FIREBASE_SERVICE_ACCOUNT_JSON');
    if (json?.trim()) {
      try {
        const serviceAccount = JSON.parse(json) as admin.ServiceAccount;
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
        });
        this.logger.log('Firebase Admin initialized from FIREBASE_SERVICE_ACCOUNT_JSON');
        return true;
      } catch (error) {
        this.logger.warn(
          `Firebase Admin init failed (invalid FIREBASE_SERVICE_ACCOUNT_JSON): ${(error as Error).message}`,
        );
        return false;
      }
    }

    try {
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
      });
      this.logger.log('Firebase Admin initialized from application default credentials');
      return true;
    } catch (error) {
      this.logger.warn(
        `Firebase Admin not configured — FCM push disabled: ${(error as Error).message}`,
      );
      return false;
    }
  }

  async send(messages: FcmPushPayload[]): Promise<string[]> {
    if (!this.ready || !messages.length) return [];

    const invalid: string[] = [];

    await Promise.all(
      messages.map(async (message) => {
        try {
          await admin.messaging().send({
            token: message.token,
            notification: {
              title: message.title,
              body: message.body,
            },
            data: {
              chatId: message.data.chatId,
              messageId: message.data.messageId,
              type: message.data.type,
              ...(message.data.senderId
                ? { senderId: message.data.senderId }
                : {}),
            },
            android: {
              priority: 'high',
              notification: {
                channelId: CHAT_CHANNEL_ID,
                sound: 'default',
              },
            },
            apns: {
              payload: {
                aps: {
                  sound: 'default',
                },
              },
            },
          });
        } catch (error) {
          const code = (error as { code?: string }).code;
          this.logger.warn(
            `FCM push failed (${code ?? 'unknown'}): ${(error as Error).message}`,
          );
          if (
            code === 'messaging/registration-token-not-registered' ||
            code === 'messaging/invalid-registration-token'
          ) {
            invalid.push(message.token);
          }
        }
      }),
    );

    return invalid;
  }
}
