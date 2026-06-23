/**
 * Expo push settings — must match mobile `app.json` / `constants/expoPush.ts`.
 * No environment variables required; Expo delivers via exp.host using EAS project credentials.
 */
export const EXPO_PUSH_CONFIG = {
  projectId: 'c4d6c5d2-8664-4a92-b30a-2205f11532b5',
  apiUrl: 'https://exp.host/--/api/v2/push/send',
} as const;
