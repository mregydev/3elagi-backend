/**
 * Cash payments happen outside the app: the doctor names a price and a payment
 * link, the patient pays and uploads the receipt, the doctor approves it.
 * Nothing is confirmed (no meeting link, no open consultation) until then.
 */
export type PaymentState =
  | 'none'
  | 'awaiting_payment'
  | 'proof_submitted'
  | 'paid';
