/** Run: npx ts-node src/push-notifications/sender-name.check.ts */
import * as assert from 'node:assert';
import { withSenderName } from './push-notifications.service';

assert.equal(withSenderName('Ahmed', 'see you tomorrow'), 'Ahmed: see you tomorrow');

// Already prefixed (a forwarded/system-composed body) must not double up.
assert.equal(withSenderName('Ahmed', 'Ahmed: see you'), 'Ahmed: see you');
assert.equal(withSenderName('Ahmed', 'ahmed: see you'), 'ahmed: see you');

// Missing halves degrade instead of producing stray punctuation.
assert.equal(withSenderName('', 'see you'), 'see you');
assert.equal(withSenderName('Ahmed', ''), 'Ahmed');

console.log('sender-name checks passed');
