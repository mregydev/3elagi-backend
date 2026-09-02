/** Public Supabase storage URLs for marketing email screenshots. */
export const MARKETING_SCREENSHOTS_PUBLIC_BASE =
  'https://hjluqxfmvpvtjvwzqxgi.supabase.co/storage/v1/object/public/files/static/marketing';

export const MARKETING_SCREENSHOT_URLS = {
  chat: `${MARKETING_SCREENSHOTS_PUBLIC_BASE}/chat-consultation.png`,
  xrayRecord: `${MARKETING_SCREENSHOTS_PUBLIC_BASE}/xray-record.png`,
  xrayDetail: `${MARKETING_SCREENSHOTS_PUBLIC_BASE}/xray-detail.png`,
  skeleton: `${MARKETING_SCREENSHOTS_PUBLIC_BASE}/skeleton-view.png`,
  ai: `${MARKETING_SCREENSHOTS_PUBLIC_BASE}/ai-assistant.png`,
} as const;

export type MarketingScreenshotKey = keyof typeof MARKETING_SCREENSHOT_URLS;
