export const DAILY_CONFIG = {
  apiUrl: 'https://api.daily.co/v1/rooms',
  // Prefer the DAILY_API_KEY env var (set it on the server). The fallback is the
  // 3elagi.daily.co team key so video calls work out of the box; move it to env
  // for production and rotate if it ever leaks.
  apiKey:
    process.env.DAILY_API_KEY?.trim() ||
    'aabe7c7fbdee3c4c4d675e7f85aa599ed9d5767242ae40e6ec6792e59f7b6b6a',
} as const;
