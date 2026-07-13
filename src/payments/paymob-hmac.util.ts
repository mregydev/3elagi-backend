import { createHmac, timingSafeEqual } from 'crypto';

/** Paymob transaction processed callback (POST body.obj). */
export function validatePaymobTransactionHmac(
  obj: Record<string, unknown>,
  receivedHmac: string | undefined,
  hmacSecret: string,
): boolean {
  if (!receivedHmac?.trim() || !hmacSecret.trim()) return false;

  const order = obj.order as Record<string, unknown> | undefined;
  const source = obj.source_data as Record<string, unknown> | undefined;
  const fields = [
    obj.amount_cents,
    obj.created_at,
    obj.currency,
    obj.error_occured,
    obj.has_parent_transaction,
    obj.id,
    obj.integration_id,
    obj.is_3d_secure,
    obj.is_auth,
    obj.is_capture,
    obj.is_refunded,
    obj.is_standalone_payment,
    obj.is_voided,
    order?.id,
    obj.owner,
    obj.pending,
    source?.pan,
    source?.sub_type,
    source?.type,
    obj.success,
  ];

  const concatenated = fields.map((v) => String(v ?? '')).join('');
  const computed = createHmac('sha512', hmacSecret)
    .update(concatenated)
    .digest('hex');

  const a = Buffer.from(computed.toLowerCase());
  const b = Buffer.from(receivedHmac.trim().toLowerCase());
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
