/** Run: npx ts-node src/auth/doctor-approval.check.ts */
import * as assert from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Self-signup doctors start pending; admin creation passes autoApprove and
 * lands approved. Browse, booking, reviews and AI all gate on approved.
 */
const signup = fs.readFileSync(path.join(__dirname, 'auth.service.ts'), 'utf8');
const registerDoctor = signup.slice(
  signup.indexOf('async registerDoctor('),
  signup.indexOf('async verifyEmail('),
);

assert.ok(
  registerDoctor.includes('autoApprove ? \'approved\' : \'pending\''),
  'registerDoctor must branch approval on autoApprove',
);
assert.ok(
  registerDoctor.includes('email_verified_at: autoApprove ? new Date() : null'),
  'only admin-created doctors may skip email verification at signup',
);
assert.ok(
  registerDoctor.includes('if (!autoApprove)'),
  'self-signup doctors must receive a verification code',
);

const admin = fs.readFileSync(
  path.join(__dirname, '..', 'admin', 'admin.service.ts'),
  'utf8',
);
const createDoctor = admin.slice(
  admin.indexOf('async createDoctor('),
  admin.indexOf('async updateDoctor('),
);

assert.ok(
  createDoctor.includes('autoApprove: true'),
  'admin createDoctor must pass autoApprove to registerDoctor',
);
assert.ok(
  createDoctor.includes("setDoctorApproval(doctorId, 'approved')"),
  'admin createDoctor must approve the doctor',
);
assert.ok(
  createDoctor.includes('email_verified_at: new Date()'),
  'admin createDoctor must mark the user email verified',
);

const approval = admin.slice(admin.indexOf('async setDoctorApproval('));
assert.ok(
  approval.includes("this.doctorRepo.update(id, { approval_status: status })"),
  'setDoctorApproval must write the doctor status',
);
assert.ok(
  approval.includes('broadcastDoctorRegistered'),
  'approving must broadcast the doctor into the rosters',
);

console.log('doctor-approval.check OK');
