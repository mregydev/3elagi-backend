/** Run: npx ts-node src/consultations/consultation-notify.check.ts */
import * as assert from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Every consultation action the patient cares about must go through
 * postActionMessage, which is the single place that emits over the socket AND
 * files the in-app notification / device push. A future action that writes to
 * the message repo directly would silently skip the push.
 */
const src = fs.readFileSync(
  path.join(__dirname, 'consultations.service.ts'),
  'utf8',
);

for (const method of ['async accept(', 'async reject(']) {
  const start = src.indexOf(method);
  assert.ok(start > -1, `${method} missing`);
  const body = src.slice(start, src.indexOf('\n  async ', start + 1));
  assert.ok(
    body.includes('this.postActionMessage('),
    `${method} must notify the patient via postActionMessage`,
  );
}

// postActionMessage itself must still reach the push service.
const poster = src.slice(src.indexOf('private async postActionMessage('));
assert.ok(
  poster.includes('this.notifyRecipient('),
  'postActionMessage must call notifyRecipient',
);
const notifier = src.slice(src.indexOf('private async notifyRecipient('));
assert.ok(
  notifier.includes('this.pushNotifications.sendChatMessage('),
  'notifyRecipient must push through PushNotificationsService',
);

console.log('consultation-notify checks passed');
