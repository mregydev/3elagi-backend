/**
 * OneSignal push settings — must match mobile `constants/onesignal.ts`.
 * Add your REST API Key from OneSignal Dashboard → Settings → Keys & IDs.
 */
export const ONESIGNAL_CONFIG = {
  appId: 'cdb484c9-84b2-4239-bbf8-cefe299e554c',
  apiUrl: 'https://api.onesignal.com/notifications',
  /** OneSignal REST API Key (required for server-side push). */
  restApiKey: '',
} as const;
