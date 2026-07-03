export const WHEREBY_CONFIG = {
  apiUrl: 'https://api.whereby.dev/v1/meetings',
  apiKey: process.env.WHEREBY_API_KEY?.trim() ?? '',
} as const;
