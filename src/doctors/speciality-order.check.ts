/** Run: npx ts-node src/doctors/speciality-order.check.ts */
import * as assert from 'node:assert';
import type { Doctor } from '../entities/doctor.entity';
import type { DoctorSpeciality } from '../entities/doctor-speciality.entity';

import { sortPrimaryFirst } from './doctors.service';

const spec = (id: string) => ({ id }) as DoctorSpeciality;
const doctor = (primary: string | null, linked: string[]) =>
  ({ speciality_id: primary, specialities: linked.map(spec) }) as Doctor;

// The primary leads, and it is never listed twice.
assert.deepStrictEqual(sortPrimaryFirst(doctor('a', ['b', 'a', 'c'])), [
  'a',
  'b',
  'c',
]);

// A doctor whose links were never backfilled still reports their speciality.
assert.deepStrictEqual(sortPrimaryFirst(doctor('a', [])), ['a']);

// No primary set → whatever is linked, no empty string leading the list.
assert.deepStrictEqual(sortPrimaryFirst(doctor(null, ['b'])), ['b']);
assert.deepStrictEqual(sortPrimaryFirst(doctor(null, [])), []);

console.log('speciality-order checks passed');
