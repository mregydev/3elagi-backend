/** Run: npx ts-node src/common/request-country.check.ts */
import * as assert from 'node:assert';
import {
  clientGeoFromRequest,
  clientIpFromRequest,
  countryFromRequest,
  resolvePricingCountry,
  resolveRequestCountry,
} from './request-country';

// Edge headers win, in priority order, and junk codes are ignored.
assert.equal(countryFromRequest({ 'cf-ipcountry': 'jo' }), 'JO');
assert.equal(countryFromRequest({ 'x-vercel-ip-country': 'EG' }), 'EG');
assert.equal(countryFromRequest({ 'cf-ipcountry': 'XX' }), null);
assert.equal(countryFromRequest({ 'cf-ipcountry': 'T1' }), null);
assert.equal(countryFromRequest({}), null);

// Client IP: first public hop of x-forwarded-for, skipping proxies/loopback.
assert.equal(
  clientIpFromRequest({ headers: { 'x-forwarded-for': '41.34.5.6, 10.0.0.1' } }),
  '41.34.5.6',
);
assert.equal(
  clientIpFromRequest({ headers: {}, socket: { remoteAddress: '::ffff:41.34.5.6' } }),
  '41.34.5.6',
);
// Local dev has nothing to look up rather than a bogus private address.
assert.equal(
  clientIpFromRequest({ headers: {}, socket: { remoteAddress: '127.0.0.1' } }),
  null,
);
assert.equal(
  clientIpFromRequest({ headers: { 'x-forwarded-for': '192.168.1.9' } }),
  null,
);

assert.equal(clientGeoFromRequest({ 'x-client-geo-country': 'de' }), 'DE');
assert.equal(clientGeoFromRequest({ 'x-client-geo-country': 'XX' }), null);

void (async () => {
  // Header path answers without any network call.
  assert.equal(
    await resolveRequestCountry({ headers: { 'cf-ipcountry': 'JO' } }),
    'JO',
  );
  // Client geo header when server IP is unusable (local dev / Cloud Run).
  assert.equal(
    await resolvePricingCountry({
      headers: { 'x-client-geo-country': 'DE' },
      socket: { remoteAddress: '::1' },
    }),
    'DE',
  );
  // No header and no usable IP → null (international rate).
  assert.equal(
    await resolveRequestCountry({ headers: {}, socket: { remoteAddress: '::1' } }),
    null,
  );
  console.log('request-country checks passed');
})();

// Provider response shapes seen in the wild (verified against live responses):
//   ipapi.co   -> "EG"
//   ipwho.is   -> {"country_code":"EG"}
//   ip-api.com -> {"countryCode":"EG"}
void (async () => {
  const parse = (body: string): string | null => {
    let value: unknown = body.trim();
    if (String(value).startsWith('{')) {
      const json = JSON.parse(String(value)) as Record<string, unknown>;
      value = json.countryCode ?? json.country_code ?? json.country;
    }
    const code = String(value ?? '').trim().toUpperCase();
    return /^[A-Z]{2}$/.test(code) ? code : null;
  };
  assert.equal(parse('EG\n'), 'EG');
  assert.equal(parse('{\n    "country_code": "EG"\n}'), 'EG');
  assert.equal(parse('{"countryCode":"EG"}'), 'EG');
  assert.equal(parse('{"error":true}'), null);
  console.log('provider-shape checks passed');
})();
