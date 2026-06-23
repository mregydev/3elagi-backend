/**
 * OneSignal push settings — must match mobile `constants/onesignal.ts`.
 * Set ONESIGNAL_REST_API_KEY in Cloud Run / .env for production.
 */
export const ONESIGNAL_CONFIG = {
  appId:
    process.env.ONESIGNAL_APP_ID?.trim() ||
    'cdb484c9-84b2-4239-bbf8-cefe299e554c',
  apiUrl: 'https://api.onesignal.com/notifications',
  restApiKey: process.env.ONESIGNAL_REST_API_KEY?.trim() || 'os_v2_app_zw2ijsmewjbdto7yz37cthsvjrsynckdhdjeg246ushtjbxadtnmkroxgd6nxw2tg4bumc2y7o3ocvyc45te3j745opuwqzb3afotji',
} as const;
