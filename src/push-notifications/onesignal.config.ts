/**
 * OneSignal push settings — must match mobile `constants/onesignal.ts`.
 * Required on Cloud Run: ONESIGNAL_REST_API_KEY (App REST API Key from OneSignal Dashboard).
 */
export const ONESIGNAL_CONFIG = {
  appId:
    process.env.ONESIGNAL_APP_ID?.trim() ||
    'cdb484c9-84b2-4239-bbf8-cefe299e554c',
  apiUrl: 'https://api.onesignal.com/notifications',
  restApiKey:
    process.env.ONESIGNAL_REST_API_KEY?.trim() ||
    'os_v2_app_zw2ijsmewjbdto7yz37cthsvjqh3uutstabegovtrifqdgikxou4jjgkfg6bgrdsrsggoutbvqgm5vsh6klwh57fmi7uxet7x7wpara',
} as const;
