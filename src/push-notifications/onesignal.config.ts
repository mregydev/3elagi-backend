/**
 * OneSignal push settings — must match mobile `constants/onesignal.ts`.
 * Add your REST API Key from OneSignal Dashboard → Settings → Keys & IDs.
 */
export const ONESIGNAL_CONFIG = {
  appId: 'cdb484c9-84b2-4239-bbf8-cefe299e554c',
  apiUrl: 'https://api.onesignal.com/notifications',
  /** OneSignal REST API Key (required for server-side push). */
  restApiKey: 'os_v2_app_zw2ijsmewjbdto7yz37cthsvjrwoprqehkfeybn4jm4omgljdeipxxxzw2ahfmu6fwdrohokha3cjpkubufw32i4g374lddk6epb3ny',
} as const;
