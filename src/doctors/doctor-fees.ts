/**
 * What a doctor charges a given patient, in cash, outside the app.
 *
 * A doctor keeps two prices per consultation kind: one in their own currency
 * for patients in their country (EGP in Egypt, JOD in Jordan), and one in USD
 * for everyone else.
 */
import type { Doctor } from '../entities/doctor.entity';

export type ConsultationKind = 'text' | 'video';

/**
 * Starting prices every doctor gets, by market. Egypt bills locals 200 EGP,
 * Jordan bills locals 15 JOD, and both bill 50 USD abroad. Doctors change them
 * from their profile; these are only the defaults.
 */
export const DEFAULT_DOCTOR_FEES: Record<
  'EG' | 'JO',
  { local: number; usd: number }
> = {
  EG: { local: 200, usd: 50 },
  JO: { local: 15, usd: 50 },
};

/** The four fee columns a newly created doctor starts with. */
export function defaultDoctorFeeColumns(country?: string | null): {
  text_price_local: string;
  text_price_usd: string;
  video_price_local: string;
  video_price_usd: string;
} {
  const code = country?.trim().toUpperCase();
  const fees =
    code === 'JO' ? DEFAULT_DOCTOR_FEES.JO : DEFAULT_DOCTOR_FEES.EG;
  return {
    text_price_local: fees.local.toFixed(2),
    text_price_usd: fees.usd.toFixed(2),
    video_price_local: fees.local.toFixed(2),
    video_price_usd: fees.usd.toFixed(2),
  };
}
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
