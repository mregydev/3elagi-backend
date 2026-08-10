/** Run: npx ts-node src/push-notifications/sender-name.check.ts */
import * as assert from 'node:assert';
import { withSenderName } from './push-notifications.service';

assert.equal(withSenderName('Ahmed', 'see you tomorrow'), 'Ahmed: see you tomorrow');

// Bodies that already name the sender must not double up, colon or not.
assert.equal(withSenderName('Ahmed', 'Ahmed: see you'), 'Ahmed: see you');
assert.equal(withSenderName('Ahmed', 'ahmed: see you'), 'ahmed: see you');
assert.equal(
  withSenderName('Alaa Patient', 'Alaa Patient uploaded a new X-ray document'),
  'Alaa Patient uploaded a new X-ray document',
);

// A different name that merely starts similarly still gets prefixed.
assert.equal(withSenderName('Ahmed', 'Ahmad sent this'), 'Ahmed: Ahmad sent this');

// Missing halves degrade instead of producing stray punctuation.
assert.equal(withSenderName('', 'see you'), 'see you');
assert.equal(withSenderName('Ahmed', ''), 'Ahmed');

console.log('sender-name checks passed');
