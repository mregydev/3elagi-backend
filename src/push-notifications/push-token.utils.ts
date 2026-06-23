import { isValidExpoPushToken } from './expo-push.tokens';

/** Native FCM/APNs device tokens from Firebase Messaging or getDevicePushTokenAsync. */
export function isValidFcmPushToken(token: string): boolean {
  const trimmed = token.trim();
  if (!trimmed || isValidExpoPushToken(trimmed)) return false;
  return /^[A-Za-z0-9_\-:.]{20,}$/.test(trimmed);
}

export type PushTokenKind = 'expo' | 'fcm';

export function classifyPushToken(token: string): PushTokenKind | null {
  const trimmed = token.trim();
  if (isValidExpoPushToken(trimmed)) return 'expo';
  if (isValidFcmPushToken(trimmed)) return 'fcm';
  return null;
}

export function isRecognizedPushToken(token: string): boolean {
  return classifyPushToken(token) !== null;
}
