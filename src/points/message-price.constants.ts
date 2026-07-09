/** Consultation reserve amount in EGP credits. */
export const MIN_CONSULTATION_PRICE = 1;
export const MAX_CONSULTATION_PRICE = 100_000;
export const DEFAULT_CONSULTATION_PRICE = 1;

export function clampConsultationPrice(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return DEFAULT_CONSULTATION_PRICE;
  const rounded = Math.round(n);
  return Math.min(
    MAX_CONSULTATION_PRICE,
    Math.max(MIN_CONSULTATION_PRICE, rounded),
  );
}

/** Video consultation duration must be 30, 60 or 120 minutes. */
export function clampVideoConsultationMinutes(value: unknown): number {
  const n = Number(value);
  return [30, 60, 120].includes(n) ? n : 30;
}
