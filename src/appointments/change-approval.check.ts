/** Run: npx ts-node src/appointments/change-approval.check.ts */
import * as assert from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Anything already agreed — a confirmed visit, an open consultation — can only
 * be moved or undone with the other side's answer, and the person who asked is
 * never the person who answers.
 */
const appointments = fs.readFileSync(
  path.join(__dirname, 'appointments-chat.service.ts'),
  'utf8',
);
const handle = appointments.slice(appointments.indexOf('async handleAction('));

// A pending visit can still be dropped outright; an approved one cannot.
assert.ok(
  handle.includes('if (appointment.status === AppointmentStatus.PENDING)') &&
    handle.includes("emitted = 'cancel_request'"),
  'cancelling an approved appointment must become a request',
);
assert.ok(
  handle.includes("throw new ForbiddenException('The other person has to answer this')"),
  'the requester must not be able to answer their own request',
);
assert.ok(
  handle.includes("if (!isFutureSlot(date, time))"),
  'a reschedule must land in the future',
);
assert.ok(
  handle.includes('Cannot change the time after the meeting has started'),
  'reschedule must be blocked once the meeting start time has passed',
);
// Accepting a new slot must not reuse the old room, which expires at the old time.
const accepted = handle.slice(handle.indexOf("if (action === 'reschedule_accepted') {"));
assert.ok(
  accepted.includes('appointment.meeting_link = null') &&
    accepted.includes('ensureMeetingAssets('),
  'accepting a new slot must mint a room for it',
);
assert.ok(
  handle.includes("action === 'cancel_approved'") &&
    handle.includes('releaseAppointmentCredits('),
  'an approved cancellation must release the credits',
);

const messages = fs.readFileSync(
  path.join(__dirname, '..', 'messages', 'messages.service.ts'),
  'utf8',
);
assert.ok(
  messages.includes("'reschedule_request'") &&
    messages.includes("'cancel_approved'"),
  'messages.service must allow reschedule/cancel approval actions',
);

const notificationContent = fs.readFileSync(
  path.join(__dirname, '..', 'notifications', 'notification-content.ts'),
  'utf8',
);
assert.ok(
  notificationContent.includes('Meeting time update request') &&
    notificationContent.includes('accepted the meeting time change'),
  'in-app notifications must describe meeting time changes',
);

const consultations = fs.readFileSync(
  path.join(__dirname, '..', 'consultations', 'consultations.service.ts'),
  'utf8',
);
const cancel = consultations.slice(
  consultations.indexOf('  async cancel('),
  consultations.indexOf('  async reviewCancel('),
);
assert.ok(
  cancel.includes("action: 'cancel_request'") && !cancel.includes("c.status = 'cancelled'"),
  'cancelling an open consultation must only ask, not close it',
);
const review = consultations.slice(consultations.indexOf('  async reviewCancel('));
assert.ok(
  review.includes('if (pending.by === userId)') &&
    review.includes('this.points.refundReserved(') &&
    review.includes("c.status = 'cancelled'"),
  'approving must be done by the other side, close it and refund',
);

console.log('change-approval.check OK');
