/**
 * What a doctor charges a given patient, in cash, outside the app.
 *
 * A doctor keeps two prices per consultation kind: one in their own currency
 * for patients in their country (EGP in Egypt, JOD in Jordan), and one in USD
 * for everyone else.
 */
import type { Doctor } from '../entities/doctor.entity';

export type ConsultationKind = 'text' | 'video';
export type FeeCurrency = 'EGP' | 'JOD' | 'USD';

export interface DoctorFee {
  amount: number;
  currency: FeeCurrency;
  /** Where the patient pays; null when the doctor has not set a link. */
  payment_link: string | null;
}

/** The doctor's home currency. Anything but Egypt/Jordan bills in USD. */
export function doctorLocalCurrency(country?: string | null): FeeCurrency {
  const code = country?.trim().toUpperCase();
  if (code === 'EG') return 'EGP';
  if (code === 'JO') return 'JOD';
  return 'USD';
}

function toAmount(value: string | null | undefined): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * Fee for this patient. Same country as the doctor → local price and currency;
 * anywhere else (or unknown country) → the USD price.
 */
export function resolveDoctorFee(
  doctor: Pick<
    Doctor,
    | 'country'
    | 'text_price_local'
    | 'text_price_usd'
    | 'video_price_local'
    | 'video_price_usd'
    | 'payment_link'
  >,
  patientCountry: string | null | undefined,
  kind: ConsultationKind,
): DoctorFee {
  const home = doctor.country?.trim().toUpperCase() || '';
  const patient = patientCountry?.trim().toUpperCase() || '';
  // Unknown patient country is treated as abroad — never undercharge on a guess.
  const isHome = !!home && patient === home;

  const amount = isHome
    ? toAmount(kind === 'video' ? doctor.video_price_local : doctor.text_price_local)
    : toAmount(kind === 'video' ? doctor.video_price_usd : doctor.text_price_usd);

  return {
    amount,
    currency: isHome ? doctorLocalCurrency(home) : 'USD',
    payment_link: doctor.payment_link?.trim() || null,
  };
}
