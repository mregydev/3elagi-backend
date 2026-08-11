import {
  normalizeMarketCountry,
  type MarketCountryCode,
} from '../common/patient-countries';

export type MarketCurrency = 'EGP' | 'JOD' | 'USD';

/** Egypt, Jordan, or everywhere else. */
export type PointMarket = MarketCountryCode | 'INTL';

export interface MarketPointPricing {
  market: PointMarket;
  currency: MarketCurrency;
  /** Cash charged per 1 credit/point (display currency). */
  pricePerPoint: number;
  billingCountry: MarketCountryCode;
  billingCity: string;
}

/** Top-up FX: Egypt 100 EGP, Jordan 10 JOD, rest of world 5 USD per point. */
export const MARKET_POINT_PRICING: Record<PointMarket, MarketPointPricing> = {
  EG: {
    market: 'EG',
    currency: 'EGP',
    pricePerPoint: 100,
    billingCountry: 'EG',
    billingCity: 'Cairo',
  },
  JO: {
    market: 'JO',
    currency: 'JOD',
    pricePerPoint: 10,
    billingCountry: 'JO',
    billingCity: 'Amman',
  },
  INTL: {
    market: 'INTL',
    currency: 'USD',
    pricePerPoint: 5,
    // Paymob settles in Egypt regardless of where the payer sits.
    billingCountry: 'EG',
    billingCity: 'Cairo',
  },
};

/**
 * Default JOD → EGP rate from point parity:
 * 1 point = 10 JOD = 100 EGP → 1 JOD = 10 EGP.
 * Override with env `JOD_TO_EGP_RATE`.
 */
export const DEFAULT_JOD_TO_EGP_RATE =
  MARKET_POINT_PRICING.EG.pricePerPoint / MARKET_POINT_PRICING.JO.pricePerPoint;

/** Same parity for USD: 1 point = 5 USD = 100 EGP → 1 USD = 20 EGP. */
export const DEFAULT_USD_TO_EGP_RATE =
  MARKET_POINT_PRICING.EG.pricePerPoint / MARKET_POINT_PRICING.INTL.pricePerPoint;

/** Anything outside Egypt and Jordan pays the international USD rate. */
export function resolvePointMarket(country?: string | null): PointMarket {
  const code = country?.trim().toUpperCase();
  if (code === 'EG' || code === 'JO') return code;
  return code ? 'INTL' : normalizeMarketCountry(country);
}

export function resolveMarketPricing(
  country?: string | null,
): MarketPointPricing {
  return MARKET_POINT_PRICING[resolvePointMarket(country)];
}

/** Display cash for buying `points` in the given market (EGP or JOD). */
export function moneyForPoints(
  points: number,
  country?: string | null,
): number {
  const pricing = resolveMarketPricing(country);
  return Math.round(points) * pricing.pricePerPoint;
}

/** Convert Jordan dinars to Egyptian pounds for Paymob (always charges EGP). */
export function jodToEgp(
  amountJod: number,
  rate: number = DEFAULT_JOD_TO_EGP_RATE,
): number {
  const safeRate =
    Number.isFinite(rate) && rate > 0 ? rate : DEFAULT_JOD_TO_EGP_RATE;
  return Math.max(1, Math.round(amountJod * safeRate));
}

/** Same, for international payers priced in USD. */
export function usdToEgp(
  amountUsd: number,
  rate: number = DEFAULT_USD_TO_EGP_RATE,
): number {
  const safeRate =
    Number.isFinite(rate) && rate > 0 ? rate : DEFAULT_USD_TO_EGP_RATE;
  return Math.max(1, Math.round(amountUsd * safeRate));
}

/**
 * Amount to send to Paymob.
 * Jordan display prices stay in JOD; Paymob is always charged in EGP.
 */
export function paymobChargeForMarket(
  displayMoney: number,
  marketCurrency: MarketCurrency,
  jodToEgpRate: number = DEFAULT_JOD_TO_EGP_RATE,
  usdToEgpRate: number = DEFAULT_USD_TO_EGP_RATE,
): { amountEgp: number; currency: 'EGP' } {
  if (marketCurrency === 'JOD') {
    return { amountEgp: jodToEgp(displayMoney, jodToEgpRate), currency: 'EGP' };
  }
  if (marketCurrency === 'USD') {
    return { amountEgp: usdToEgp(displayMoney, usdToEgpRate), currency: 'EGP' };
  }
  return { amountEgp: Math.round(displayMoney), currency: 'EGP' };
}
