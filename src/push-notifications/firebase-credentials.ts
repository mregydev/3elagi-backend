import { readFileSync } from 'fs';
import { resolve } from 'path';
import type { ServiceAccount } from 'firebase-admin';
import type { ConfigService } from '@nestjs/config';

export function loadFirebaseServiceAccount(
  config: ConfigService,
): ServiceAccount | null {
  const jsonInline = config.get<string>('FIREBASE_SERVICE_ACCOUNT_JSON');
  if (jsonInline?.trim()) {
    try {
      return JSON.parse(jsonInline) as ServiceAccount;
    } catch {
      return null;
    }
  }

  const filePath = config.get<string>('FIREBASE_SERVICE_ACCOUNT_PATH');
  if (!filePath?.trim()) return null;

  try {
    const absolutePath = resolve(process.cwd(), filePath.trim());
    const raw = readFileSync(absolutePath, 'utf8');
    return JSON.parse(raw) as ServiceAccount;
  } catch {
    return null;
  }
}
