/** Run: npx ts-node src/common/request-country.check.ts */
import * as assert from 'node:assert';
import {
  clientIpFromRequest,
  countryFromRequest,
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

void (async () => {
  // Header path answers without any network call.
  assert.equal(
    await resolveRequestCountry({ headers: { 'cf-ipcountry': 'JO' } }),
    'JO',
  );
  // No header and no usable IP → null, so callers fall back deliberately.
  assert.equal(
    await resolveRequestCountry({ headers: {}, socket: { remoteAddress: '::1' } }),
    null,
  );
  console.log('request-country checks passed');
})();
