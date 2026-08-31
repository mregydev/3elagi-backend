import type { ConfigService } from '@nestjs/config';
import type { Response } from 'express';

export const ACCESS_TOKEN_COOKIE = 'access_token';
export const REFRESH_TOKEN_COOKIE = 'refresh_token';

export const ACCESS_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
export const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type AuthClientKind = 'web' | 'native';

export function resolveAuthClient(
  header: string | undefined,
): AuthClientKind {
  return header?.trim().toLowerCase() === 'native' ? 'native' : 'web';
}

function cookieBase(config: ConfigService) {
  const secure =
    config.get<string>('COOKIE_SECURE') === 'true' ||
    config.get<string>('NODE_ENV') === 'production';
  const domain = config.get<string>('COOKIE_DOMAIN')?.trim() || undefined;
  return {
    httpOnly: true,
    secure,
    sameSite: (secure ? 'none' : 'lax') as 'none' | 'lax',
    ...(domain ? { domain } : {}),
  };
}

export function setAuthCookies(
  res: Response,
  config: ConfigService,
  tokens: { accessToken: string; refreshToken: string },
): void {
  const base = cookieBase(config);
  res.cookie(ACCESS_TOKEN_COOKIE, tokens.accessToken, {
    ...base,
    path: '/',
    maxAge: ACCESS_TOKEN_TTL_MS,
  });
  res.cookie(REFRESH_TOKEN_COOKIE, tokens.refreshToken, {
    ...base,
    path: '/3eyadahub-api/auth',
    maxAge: REFRESH_TOKEN_TTL_MS,
  });
}

export function clearAuthCookies(res: Response, config: ConfigService): void {
  const base = cookieBase(config);
  res.clearCookie(ACCESS_TOKEN_COOKIE, { ...base, path: '/' });
  res.clearCookie(REFRESH_TOKEN_COOKIE, {
    ...base,
    path: '/3eyadahub-api/auth',
  });
}

const DEV_CORS_ORIGINS = [
  'https://development.3elagi.net',
  'http://development.3elagi.net',
  'http://localhost:8081',
  'http://127.0.0.1:8081',
];

export function corsOrigins(config: ConfigService): string[] {
  const allowed = new Set(DEV_CORS_ORIGINS);

  const raw = config.get<string>('CORS_ORIGINS')?.trim();
  if (raw) {
    for (const origin of raw.split(',').map((o) => o.trim()).filter(Boolean)) {
      allowed.add(origin.replace(/\/$/, ''));
    }
  }

  return [...allowed];
}
