/** Run: npx ts-node src/appointments/payment-gate.check.ts */
import * as assert from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * A paid visit must not become real before the money does: no meeting link and
 * no confirmed status until the doctor approves the patient's receipt.
 */
const appointments = fs.readFileSync(
  path.join(__dirname, 'appointments-chat.service.ts'),
  'utf8',
);

// Booking must not mint a room the patient could join before confirmation.
const booking = appointments.slice(
  appointments.indexOf('async bookFromChat('),
  appointments.indexOf('private async ensureMeetingAssets('),
);
assert.ok(
  !booking.includes('ensureMeetingAssets('),
  'booking must not create the meeting room',
);
assert.ok(
  booking.includes('meeting_link: null'),
  'the booking request message must carry no meeting link',
);

// The room is created in exactly one place: the confirm path.
const confirm = appointments.slice(
  appointments.indexOf('private async confirmAppointment('),
  appointments.indexOf('async handleAction('),
);
assert.ok(
  confirm.includes('AppointmentStatus.CONFIRMED') &&
    confirm.includes('ensureMeetingAssets('),
  'confirmAppointment must set CONFIRMED and create the room',
);

const handle = appointments.slice(appointments.indexOf('async handleAction('));
assert.ok(
  handle.includes("appointment.payment_status = 'awaiting_payment'") &&
    handle.includes("emitted = 'payment_request'"),
  'confirming a priced visit must ask for payment instead of opening it',
);
assert.ok(
  handle.includes("appointment.payment_status = 'paid'") &&
    handle.includes('await this.confirmAppointment('),
  'approving the receipt must be what confirms the visit',
);
for (const guard of [
  "throw new ForbiddenException('Only the patient can send a receipt')",
  "throw new ForbiddenException('Only the doctor can review the payment')",
]) {
  assert.ok(handle.includes(guard), `missing guard: ${guard}`);
}

const consultations = fs.readFileSync(
  path.join(__dirname, '..', 'consultations', 'consultations.service.ts'),
  'utf8',
);
const accept = consultations.slice(
  consultations.indexOf('  async accept('),
  consultations.indexOf('  private async resolveTextFee('),
);
assert.ok(
  accept.includes('if (requirePayment)') &&
    !accept.includes("c.status = 'open'"),
  'accepting with payment required must leave the consultation pending',
);
const review = consultations.slice(
  consultations.indexOf('  async reviewPayment('),
);
assert.ok(
  review.includes("c.payment_status = 'paid'") &&
    review.includes("this.openAccepted(c, doctorUserId, 'payment_approved')"),
  'approving the receipt must open the consultation',
);

console.log('payment-gate.check OK');
