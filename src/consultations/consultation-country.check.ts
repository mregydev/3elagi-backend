/** Run: npx ts-node src/consultations/consultation-country.check.ts */
import * as assert from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * The consultation request the doctor sees must name the patient's country, and
 * that country must come from the caller's IP — not from the request body,
 * which a client could set to anything.
 */
const controller = fs.readFileSync(
  path.join(__dirname, 'consultations.controller.ts'),
  'utf8',
);
const start = controller.slice(controller.indexOf("@Post('start')"));
const startHandler = start.slice(0, start.indexOf('@Post(', 1));

assert.ok(
  startHandler.includes('resolvePricingCountry(req)'),
  'start must resolve the country from the request (IP / edge headers)',
);
assert.ok(
  !/dto\.\w*country/i.test(startHandler),
  'start must not take the country from the client payload',
);

const service = fs.readFileSync(
  path.join(__dirname, 'consultations.service.ts'),
  'utf8',
);
const startMethod = service.indexOf('async start(');
assert.ok(startMethod > -1, 'start( missing');
const startBody = service.slice(
  startMethod,
  service.indexOf('\n  private async ', startMethod + 1),
);
assert.ok(
  startBody.includes('patient_country: patientCountry'),
  'the request message meta must carry the resolved patient country',
);

console.log('consultation-country.check OK');
