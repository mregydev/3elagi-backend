/** ISO 3166-1 alpha-2 codes patients may select as residence. */
export const PATIENT_COUNTRY_CODES = [
  'EG',
  'SA',
  'AE',
  'JO',
  'KW',
  'QA',
  'BH',
  'OM',
  'LB',
  'IQ',
  'LY',
  'SD',
  'MA',
  'TN',
  'DZ',
  'TR',
  'DE',
  'GB',
  'US',
  'FR',
  'IT',
  'ES',
] as const;

export type PatientCountryCode = (typeof PATIENT_COUNTRY_CODES)[number];

/** Live markets for doctor signup, browse, and currency (Egypt & Jordan). */
export const MARKET_COUNTRY_CODES = ['EG', 'JO'] as const;
export type MarketCountryCode = (typeof MARKET_COUNTRY_CODES)[number];

export const DEFAULT_PATIENT_COUNTRY: MarketCountryCode = 'EG';

const COUNTRY_SET = new Set<string>(PATIENT_COUNTRY_CODES);
const MARKET_SET = new Set<string>(MARKET_COUNTRY_CODES);

export function isPatientCountryCode(value: string): value is PatientCountryCode {
  return COUNTRY_SET.has(value.trim().toUpperCase());
}

export function isMarketCountryCode(value: string): value is MarketCountryCode {
  return MARKET_SET.has(value.trim().toUpperCase());
}

/** Normalize free-text / DTO country to a supported code; default Egypt. */
export function normalizePatientCountry(
  value?: string | null,
): PatientCountryCode {
  if (!value?.trim()) return DEFAULT_PATIENT_COUNTRY;
  const code = value.trim().toUpperCase();
  return isPatientCountryCode(code) ? code : DEFAULT_PATIENT_COUNTRY;
}

/** Clamp to a live market (EG | JO); default Egypt. */
export function normalizeMarketCountry(
  value?: string | null,
): MarketCountryCode {
  if (!value?.trim()) return DEFAULT_PATIENT_COUNTRY;
  const code = value.trim().toUpperCase();
  return isMarketCountryCode(code) ? code : DEFAULT_PATIENT_COUNTRY;
}

export const PATIENT_COUNTRY_LABELS: Record<
  PatientCountryCode,
  { en: string; ar: string }
> = {
  EG: { en: 'Egypt', ar: 'مصر' },
  SA: { en: 'Saudi Arabia', ar: 'السعودية' },
  AE: { en: 'United Arab Emirates', ar: 'الإمارات' },
  JO: { en: 'Jordan', ar: 'الأردن' },
  KW: { en: 'Kuwait', ar: 'الكويت' },
  QA: { en: 'Qatar', ar: 'قطر' },
  BH: { en: 'Bahrain', ar: 'البحرين' },
  OM: { en: 'Oman', ar: 'عُمان' },
  LB: { en: 'Lebanon', ar: 'لبنان' },
  IQ: { en: 'Iraq', ar: 'العراق' },
  LY: { en: 'Libya', ar: 'ليبيا' },
  SD: { en: 'Sudan', ar: 'السودان' },
  MA: { en: 'Morocco', ar: 'المغرب' },
  TN: { en: 'Tunisia', ar: 'تونس' },
  DZ: { en: 'Algeria', ar: 'الجزائر' },
  TR: { en: 'Turkey', ar: 'تركيا' },
  DE: { en: 'Germany', ar: 'ألمانيا' },
  GB: { en: 'United Kingdom', ar: 'المملكة المتحدة' },
  US: { en: 'United States', ar: 'الولايات المتحدة' },
  FR: { en: 'France', ar: 'فرنسا' },
  IT: { en: 'Italy', ar: 'إيطاليا' },
  ES: { en: 'Spain', ar: 'إسبانيا' },
};

export function patientCountryLabel(
  code: PatientCountryCode,
  lang: 'en' | 'ar' = 'en',
): string {
  return PATIENT_COUNTRY_LABELS[code][lang];
}
