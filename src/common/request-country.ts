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

/**
 * `{ip}` is replaced with the client address. Tried in order until one answers,
 * because the free tiers rate-limit and a single provider going quiet would
 * leave every caller undetected. `GEOIP_LOOKUP_URL` overrides the whole list.
 */
const LOOKUP_URLS = (
  process.env.GEOIP_LOOKUP_URL?.trim() ||
  [
    'https://ipapi.co/{ip}/country/',
    'https://ipwho.is/{ip}?fields=country_code',
    'http://ip-api.com/json/{ip}?fields=countryCode',
  ].join(',')
)
  .split(',')
  .map((url) => url.trim())
  .filter(Boolean);
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

async function askProvider(
  template: string,
  ip: string,
): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LOOKUP_TIMEOUT_MS);
  try {
    const res = await fetch(template.replace('{ip}', encodeURIComponent(ip)), {
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const body = (await res.text()).trim();
    // Providers answer with either a bare code or JSON carrying a country field.
    let value: unknown = body;
    if (body.startsWith('{')) {
      const json = JSON.parse(body) as Record<string, unknown>;
      value = json.countryCode ?? json.country_code ?? json.country;
    }
    const code = String(value ?? '').trim().toUpperCase();
    return isUsableCode(code) ? code : null;
  } catch (err) {
    // Never let geolocation slow down or break a request.
    logger.debug(`GeoIP lookup via ${template} failed for ${ip}: ${String(err)}`);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function lookupCountry(ip: string): Promise<string | null> {
  const hit = cache.get(ip);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.code;

  let code: string | null = null;
  for (const template of LOOKUP_URLS) {
    code = await askProvider(template, ip);
    if (code) break;
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
