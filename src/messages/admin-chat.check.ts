/** Run: npx ts-node src/messages/admin-chat.check.ts */
import * as assert from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Support threads: an admin can message any member and any member can reply,
 * without a consultation and without the doctor-patient access rules — but
 * nothing else about the gate may loosen.
 */
const src = fs.readFileSync(
  path.join(__dirname, 'messages.service.ts'),
  'utf8',
);
const controller = fs.readFileSync(
  path.join(__dirname, 'messages.controller.ts'),
  'utf8',
);

assert.ok(
  controller.includes("@Roles('doctor', 'patient', 'admin')"),
  'messages controller must allow admin JWTs',
);

const participants = src.slice(
  src.indexOf('private async assertChatParticipants('),
  src.indexOf('/** @deprecated alias */'),
);
assert.ok(
  participants.includes('roles.has(UserRole.ADMIN)'),
  'an admin must be an allowed chat participant',
);
assert.ok(
  participants.includes('throw new ForbiddenException('),
  'every other role pair must still be rejected',
);

const canChat = src.slice(
  src.indexOf('private async assertCanChat('),
  src.indexOf('private messagePreview('),
);
assert.ok(
  canChat.includes('this.involvesAdmin(sender, recipient)') &&
    canChat.includes('this.doctorPatientAccessService.assertCanChat('),
  'admin threads skip the access rules; everyone else still passes them',
);

// The consultation gate must not apply to admin threads.
const gate = src.slice(src.indexOf('// Doctor↔patient messaging is only open'));
assert.ok(
  gate.includes('!this.involvesAdmin(sender, recipient)') &&
    gate.includes('Start a consultation before sending messages'),
  'admin threads must bypass the consultation gate, others must not',
);

console.log('admin-chat.check OK');
