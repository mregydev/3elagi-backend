import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';
import { loadFirebaseServiceAccount } from './firebase-credentials';

/**
 * Loads the Firebase service account (FCM V1) used by Expo for Android delivery.
 * Push messages are sent via the Expo Push API; this validates Firebase is configured
 * for the same project as the mobile app (`google-services.json`).
 */
@Injectable()
export class FirebasePushConfigService implements OnModuleInit {
  private readonly logger = new Logger(FirebasePushConfigService.name);
  readonly projectId: string | null;

  constructor(private readonly config: ConfigService) {
    this.projectId = this.initFirebaseAdmin();
  }

  onModuleInit(): void {
    const expoProjectId = this.config.get<string>('EXPO_PROJECT_ID');
    if (expoProjectId) {
      this.logger.log(`Expo push project: ${expoProjectId}`);
    }
    if (this.projectId) {
      this.logger.log(`Firebase FCM project: ${this.projectId}`);
    } else {
      this.logger.warn(
        'Firebase service account not configured — set FIREBASE_SERVICE_ACCOUNT_PATH (required for Android Expo push via EAS)',
      );
    }
  }

  private initFirebaseAdmin(): string | null {
    if (admin.apps.length > 0) {
      try {
        return admin.app().options.projectId ?? null;
      } catch {
        return null;
      }
    }

    const serviceAccount = loadFirebaseServiceAccount(this.config);
    if (!serviceAccount) return null;

    try {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      const projectId =
        typeof serviceAccount.projectId === 'string'
          ? serviceAccount.projectId
          : null;
      this.logger.log(
        `Firebase Admin initialized${projectId ? ` (project: ${projectId})` : ''}`,
      );
      return projectId;
    } catch (error) {
      this.logger.warn(
        `Firebase Admin init failed: ${(error as Error).message}`,
      );
      return null;
    }
  }

  isReady(): boolean {
    return admin.apps.length > 0;
  }
}
