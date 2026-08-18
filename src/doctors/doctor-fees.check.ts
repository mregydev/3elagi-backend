/** Run: npx ts-node src/doctors/doctor-fees.check.ts */
import * as assert from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  defaultDoctorFeeColumns,
  doctorLocalCurrency,
  resolveDoctorFee,
} from './doctor-fees';

const egyptian = {
  country: 'EG',
  text_price_local: '200.00',
  text_price_usd: '50.00',
  video_price_local: '300.00',
  video_price_usd: '60.00',
  payment_link: ' https://pay.me/dr ',
};

const jordanian = {
  country: 'JO',
  text_price_local: '15.00',
  text_price_usd: '50.00',
  video_price_local: '20.00',
  video_price_usd: '60.00',
  payment_link: null,
};

// At home the doctor bills in their own currency.
assert.deepStrictEqual(resolveDoctorFee(egyptian, 'EG', 'text'), {
  amount: 200,
  currency: 'EGP',
  payment_link: 'https://pay.me/dr',
});
assert.deepStrictEqual(resolveDoctorFee(jordanian, 'jo', 'video'), {
  amount: 20,
  currency: 'JOD',
  payment_link: null,
});

// Everyone else — including the other market — pays USD.
for (const [doctor, viewer] of [
  [egyptian, 'JO'],
  [egyptian, 'SA'],
  [jordanian, 'EG'],
] as const) {
  const fee = resolveDoctorFee(doctor, viewer, 'text');
  assert.strictEqual(fee.currency, 'USD', `${viewer} must be billed in USD`);
  assert.strictEqual(fee.amount, 50);
}

// An unknown country must never fall through to the cheaper local rate.
assert.strictEqual(resolveDoctorFee(egyptian, null, 'text').currency, 'USD');
assert.strictEqual(resolveDoctorFee(egyptian, '', 'video').amount, 60);

// Unpriced means zero, not "free at some other rate".
assert.strictEqual(
  resolveDoctorFee({ ...egyptian, text_price_local: null }, 'EG', 'text').amount,
  0,
);

assert.strictEqual(doctorLocalCurrency('EG'), 'EGP');
assert.strictEqual(doctorLocalCurrency('JO'), 'JOD');
assert.strictEqual(doctorLocalCurrency('DE'), 'USD');

// Starting prices: Egypt 200 EGP / Jordan 15 JOD at home, 50 USD abroad.
const eg = defaultDoctorFeeColumns('EG');
assert.strictEqual(eg.text_price_local, '200.00');
assert.strictEqual(eg.video_price_local, '200.00');
assert.strictEqual(eg.text_price_usd, '50.00');
const jo = defaultDoctorFeeColumns('jo');
assert.strictEqual(jo.text_price_local, '15.00');
assert.strictEqual(jo.video_price_usd, '50.00');
// Anything else is treated as the Egyptian market, like the rest of the app.
assert.strictEqual(defaultDoctorFeeColumns(null).text_price_local, '200.00');

// New doctors must actually get them.
const signup = fs.readFileSync(
  path.join(__dirname, '..', 'auth', 'auth.service.ts'),
  'utf8',
);
assert.ok(
  signup.includes('...defaultDoctorFeeColumns(dto.country)'),
  'doctor signup must apply the default fees',
);

console.log('doctor-fees.check OK');
