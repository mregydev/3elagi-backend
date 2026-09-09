/**
 * Patient residence + market helpers.
 * Full country list lives in world-countries.ts (keep in sync with mobile worldCountries.ts).
 */
export {
  CONTINENT_LABELS,
  PATIENT_COUNTRY_CODES,
  PATIENT_COUNTRY_LABELS,
  WORLD_COUNTRIES,
  type PatientCountryCode,
  type WorldContinent,
  type WorldCountry,
} from './world-countries';

import {
  PATIENT_COUNTRY_CODES,
  PATIENT_COUNTRY_LABELS,
  type PatientCountryCode,
} from './world-countries';

/** Live markets for doctor browse and currency (Egypt & Jordan). */
export const MARKET_COUNTRY_CODES = ['EG', 'JO'] as const;
export type MarketCountryCode = (typeof MARKET_COUNTRY_CODES)[number];

/** Countries offered on doctor signup and register-with-us forms. */
export const DOCTOR_SIGNUP_COUNTRY_CODES = ['EG', 'JO', 'US', 'GB'] as const;
export type DoctorSignupCountryCode =
  (typeof DOCTOR_SIGNUP_COUNTRY_CODES)[number];

export const DEFAULT_PATIENT_COUNTRY: MarketCountryCode = 'EG';

const COUNTRY_SET = new Set<string>(PATIENT_COUNTRY_CODES);
const MARKET_SET = new Set<string>(MARKET_COUNTRY_CODES);
const DOCTOR_SIGNUP_SET = new Set<string>(DOCTOR_SIGNUP_COUNTRY_CODES);

export function isPatientCountryCode(
  value: string,
): value is PatientCountryCode {
  return COUNTRY_SET.has(value.trim().toUpperCase());
}

export function isMarketCountryCode(value: string): value is MarketCountryCode {
  return MARKET_SET.has(value.trim().toUpperCase());
}

export function isDoctorSignupCountryCode(
  value: string,
): value is DoctorSignupCountryCode {
  return DOCTOR_SIGNUP_SET.has(value.trim().toUpperCase());
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

export function patientCountryLabel(
  code: string,
  lang: 'en' | 'ar' = 'en',
): string {
  const key = code?.trim().toUpperCase() || DEFAULT_PATIENT_COUNTRY;
  const row = PATIENT_COUNTRY_LABELS[key] ?? PATIENT_COUNTRY_LABELS.EG;
  return row[lang];
}
