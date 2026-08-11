/**
 * Country of the caller's IP, taken from the edge/proxy that already resolved
 * it. Cloudflare, Vercel, App Engine and AWS CloudFront all geolocate at the
 * edge and pass the result down, so there is no lookup service or GeoIP
 * database to run here.
 *
 * Returns null when no proxy header is present (local dev, direct hits) — the
 * caller decides what to fall back to.
 */
const COUNTRY_HEADERS = [
  'cf-ipcountry', // Cloudflare
  'x-vercel-ip-country', // Vercel
  'x-appengine-country', // Google App Engine
  'cloudfront-viewer-country', // AWS CloudFront
  'x-geo-country', // generic / custom proxies
];

type HeaderBag = Record<string, string | string[] | undefined>;

export function countryFromRequest(headers: HeaderBag): string | null {
  for (const name of COUNTRY_HEADERS) {
    const raw = headers[name] ?? headers[name.toUpperCase()];
    const value = Array.isArray(raw) ? raw[0] : raw;
    const code = value?.trim().toUpperCase();
    // Cloudflare sends XX for anonymised/unknown clients, T1 for Tor.
    if (code && /^[A-Z]{2}$/.test(code) && code !== 'XX' && code !== 'T1') {
      return code;
    }
  }
  return null;
}
