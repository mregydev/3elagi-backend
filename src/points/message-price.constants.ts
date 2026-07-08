export const MIN_DOCTOR_MESSAGE_PRICE = 1;
export const MAX_DOCTOR_MESSAGE_PRICE = 5;
export const DEFAULT_DOCTOR_MESSAGE_PRICE = 1;

export function clampDoctorMessagePrice(value: unknown): number {
  const n = Number(value);
  if (!Number.isInteger(n)) return DEFAULT_DOCTOR_MESSAGE_PRICE;
  return Math.min(MAX_DOCTOR_MESSAGE_PRICE, Math.max(MIN_DOCTOR_MESSAGE_PRICE, n));
}

export const MIN_CONSULTATION_PRICE = 1;
export const MAX_CONSULTATION_PRICE = 100;
export const DEFAULT_CONSULTATION_PRICE = 10;

export function clampConsultationPrice(value: unknown): number {
  const n = Number(value);
  if (!Number.isInteger(n)) return DEFAULT_CONSULTATION_PRICE;
  return Math.min(MAX_CONSULTATION_PRICE, Math.max(MIN_CONSULTATION_PRICE, n));
}
