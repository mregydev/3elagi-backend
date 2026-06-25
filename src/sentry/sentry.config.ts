export const SENTRY_API_BASE_URL = 'https://sentry.io/api/0';

function sentryEnv() {
  return {
    org: process.env.SENTRY_ORG?.trim() || 'aydi-technologies-fzco',
    authToken: process.env.SENTRY_AUTH_TOKEN?.trim() || '',
  };
}

export { sentryEnv };
