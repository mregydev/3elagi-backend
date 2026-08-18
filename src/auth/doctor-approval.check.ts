/** Run: npx ts-node src/auth/doctor-approval.check.ts */
import * as assert from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * A doctor who just signed up must not be live: browse, booking, reviews and
 * the AI sources all gate on approval_status === 'approved', and only an admin
 * flips it.
 */
const signup = fs.readFileSync(path.join(__dirname, 'auth.service.ts'), 'utf8');
const doctorSignup = signup.slice(signup.indexOf('const personalClinic ='));
const created = doctorSignup.slice(0, doctorSignup.indexOf('await this.userRepo.save(user)'));

assert.ok(
  !created.includes("approval_status: 'approved'"),
  'doctor signup must not self-approve the doctor or their personal clinic',
);
assert.strictEqual(
  (created.match(/approval_status: 'pending'/g) ?? []).length,
  2,
  'both the doctor and their personal clinic start pending',
);

// The admin route is the only way in, and approving must publish the doctor.
const admin = fs.readFileSync(
  path.join(__dirname, '..', 'admin', 'admin.service.ts'),
  'utf8',
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
