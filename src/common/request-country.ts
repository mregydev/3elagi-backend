import { Logger } from '@nestjs/common';

/**
 * Country of the caller.
 *
 * 1. Edge headers, when the app sits behind a proxy that already geolocated the
 *    request (Cloudflare, Vercel, App Engine, CloudFront). Free and instant.
 * 2. Otherwise a lookup on the client IP, cached in memory — needed anywhere
 *    those headers are absent, which is where every caller was previously
 *    falling back to the default market.
 */
const COUNTRY_HEADERS = [
  'cf-ipcountry', // Cloudflare
  'x-vercel-ip-country', // Vercel
  'x-appengine-country', // Google App Engine
  'cloudfront-viewer-country', // AWS CloudFront
  'x-geo-country', // generic / custom proxies
];

/** `{ip}` is replaced with the client address. Override to change provider. */
const LOOKUP_URL =
  process.env.GEOIP_LOOKUP_URL?.trim() || 'https://ipapi.co/{ip}/country/';
const LOOKUP_TIMEOUT_MS = 1500;
const CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const CACHE_MAX = 5000;

const logger = new Logger('RequestCountry');
const cache = new Map<string, { code: string | null; at: number }>();

type HeaderBag = Record<string, string | string[] | undefined>;

export interface RequestLike {
  headers: HeaderBag;
  ip?: string;
  socket?: { remoteAddress?: string };
}

function header(headers: HeaderBag, name: string): string | undefined {
  const raw = headers[name] ?? headers[name.toUpperCase()];
  return Array.isArray(raw) ? raw[0] : raw;
}

function isUsableCode(code: string | undefined): code is string {
  // Cloudflare sends XX for anonymised clients and T1 for Tor.
  return !!code && /^[A-Z]{2}$/.test(code) && code !== 'XX' && code !== 'T1';
}

/** Country already resolved by the edge, if any. */
export function countryFromRequest(headers: HeaderBag): string | null {
  for (const name of COUNTRY_HEADERS) {
    const code = header(headers, name)?.trim().toUpperCase();
    if (isUsableCode(code)) return code;
  }
  return null;
}

/** First public hop in x-forwarded-for, else the socket address. */
export function clientIpFromRequest(req: RequestLike): string | null {
  const forwarded = header(req.headers, 'x-forwarded-for');
  const candidates = [
    ...(forwarded ? forwarded.split(',') : []),
    req.ip ?? '',
    req.socket?.remoteAddress ?? '',
  ];
  for (const raw of candidates) {
    const ip = raw.trim().replace(/^::ffff:/, '');
    if (ip && !isPrivateIp(ip)) return ip;
  }
  return null;
}

function isPrivateIp(ip: string): boolean {
  if (ip === '::1' || ip.startsWith('127.') || ip.startsWith('10.')) return true;
  if (ip.startsWith('192.168.') || ip.startsWith('169.254.')) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return true;
  if (/^f[cd]/i.test(ip)) return true; // unique-local IPv6
  return false;
}

async function lookupCountry(ip: string): Promise<string | null> {
  const hit = cache.get(ip);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.code;

  let code: string | null = null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), LOOKUP_TIMEOUT_MS);
    try {
      const res = await fetch(LOOKUP_URL.replace('{ip}', encodeURIComponent(ip)), {
        signal: controller.signal,
      });
      if (res.ok) {
        const body = (await res.text()).trim();
        // Providers return either a bare code or JSON with a country field.
        const parsed = body.startsWith('{')
          ? ((JSON.parse(body) as Record<string, unknown>).countryCode ??
              (JSON.parse(body) as Record<string, unknown>).country_code ??
              (JSON.parse(body) as Record<string, unknown>).country)
          : body;
        const upper = String(parsed ?? '').trim().toUpperCase();
        if (isUsableCode(upper)) code = upper;
      }
    } finally {
      clearTimeout(timer);
    }
  } catch (err) {
    // Never let geolocation slow down or break a request — fall back to null.
    logger.debug(`GeoIP lookup failed for ${ip}: ${String(err)}`);
  }

  if (cache.size >= CACHE_MAX) cache.clear();
  cache.set(ip, { code, at: Date.now() });
  return code;
}

/** Edge header first, then an IP lookup. Null when neither can tell. */
export async function resolveRequestCountry(
  req: RequestLike,
): Promise<string | null> {
  const fromEdge = countryFromRequest(req.headers);
  if (fromEdge) return fromEdge;

  const ip = clientIpFromRequest(req);
  if (!ip) return null;
  return lookupCountry(ip);
}
