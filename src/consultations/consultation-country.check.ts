/** Run: npx ts-node src/consultations/consultation-country.check.ts */
import * as assert from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * The consultation request the doctor sees must name the patient's country from
 * profile / client geo / server geo — never from the request body.
 */
const controller = fs.readFileSync(
  path.join(__dirname, 'consultations.controller.ts'),
  'utf8',
);
const start = controller.slice(controller.indexOf("@Post('start')"));
const startHandler = start.slice(0, start.indexOf('@Post(', 1));

assert.ok(
  startHandler.includes('resolvePatientCountry'),
  'start must resolve the patient country from profile / geo',
);
assert.ok(
  !/dto\.\w*country/i.test(startHandler),
  'start must not take the country from the client payload',
);

const service = fs.readFileSync(
  path.join(__dirname, 'consultations.service.ts'),
  'utf8',
);
assert.ok(
  service.includes('resolvePatientRequestCountry'),
  'service must use the shared patient geo resolver',
);
const startMethod = service.indexOf('async start(');
assert.ok(startMethod > -1, 'start( missing');
const startBody = service.slice(
  startMethod,
  service.indexOf('\n  private async ', startMethod + 1),
);
assert.ok(
  startBody.includes('patient_country: saved.patient_country'),
  'the request message meta must carry the resolved patient country',
);
assert.ok(
  startBody.includes('patient_country: country'),
  'the consultation row must store the country it was requested from',
);
// Rates are admin-editable in point_pricing; the constants are only a fallback
// inside PointPricingService, so the value must come through that service.
assert.ok(
  startBody.includes('this.pointPricing.resolve('),
  'the point value must come from the admin-set pricing table',
);
assert.ok(
  startBody.includes('point_price_usd:'),
  'the consultation must keep the rate it was priced at',
);

// A migration that is not listed in app.module.ts never runs.
const appModule = fs.readFileSync(
  path.join(__dirname, '..', 'app.module.ts'),
  'utf8',
);
assert.ok(
  appModule.includes('ConsultationPatientCountry1778550000000'),
  'the patient_country migration must be registered in app.module.ts',
);

console.log('consultation-country.check OK');
