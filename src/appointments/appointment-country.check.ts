/** Run: npx ts-node src/appointments/appointment-country.check.ts */
import * as assert from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';

const appointments = fs.readFileSync(
  path.join(__dirname, 'appointments-chat.service.ts'),
  'utf8',
);
const controller = fs.readFileSync(
  path.join(__dirname, 'appointments.controller.ts'),
  'utf8',
);
const entity = fs.readFileSync(
  path.join(__dirname, '..', 'entities', 'appointment.entity.ts'),
  'utf8',
);
const appModule = fs.readFileSync(
  path.join(__dirname, '..', 'app.module.ts'),
  'utf8',
);

assert.ok(
  entity.includes('pending_change'),
  'appointments entity must define pending_change',
);
assert.ok(
  appModule.includes('PendingChanges1778580000000'),
  'the pending_change migration must be registered in app.module.ts',
);
assert.ok(
  entity.includes('patient_country'),
  'appointments must store patient_country',
);
assert.ok(
  controller.includes('resolvePricingCountry(req)') &&
    controller.includes('bookFromChat') &&
    controller.includes('country'),
  'chat-book must resolve pricing country from the request IP',
);
assert.ok(
  appointments.includes('patient_country: patientCountry') &&
    appointments.includes("resolveDoctorFee(doctor, country, 'video')") &&
    !appointments.includes('profile?.country'),
  'video visit fees must use IP country, not the patient profile',
);

console.log('appointment-country.check OK');
