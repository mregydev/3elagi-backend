import {
  normalizeMarketCountry,
  type MarketCountryCode,
} from '../common/patient-countries';

export type MarketCurrency = 'EGP' | 'JOD';

export interface MarketPointPricing {
  market: MarketCountryCode;
  currency: MarketCurrency;
  /** Cash charged per 1 credit/point (display currency). */
  pricePerPoint: number;
  billingCountry: MarketCountryCode;
  billingCity: string;
}

/** Top-up FX: Egypt 100 EGP/point, Jordan 5 JOD/point. */
export const MARKET_POINT_PRICING: Record<MarketCountryCode, MarketPointPricing> =
  {
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
      pricePerPoint: 5,
      billingCountry: 'JO',
      billingCity: 'Amman',
    },
  };

/**
 * Default JOD → EGP rate from point parity:
 * 1 point = 5 JOD = 100 EGP → 1 JOD = 20 EGP.
 * Override with env `JOD_TO_EGP_RATE`.
 */
export const DEFAULT_JOD_TO_EGP_RATE =
  MARKET_POINT_PRICING.EG.pricePerPoint / MARKET_POINT_PRICING.JO.pricePerPoint;

export function resolveMarketPricing(
  country?: string | null,
): MarketPointPricing {
  return MARKET_POINT_PRICING[normalizeMarketCountry(country)];
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

/**
 * Amount to send to Paymob.
 * Jordan display prices stay in JOD; Paymob is always charged in EGP.
 */
export function paymobChargeForMarket(
  displayMoney: number,
  marketCurrency: MarketCurrency,
  jodToEgpRate: number = DEFAULT_JOD_TO_EGP_RATE,
): { amountEgp: number; currency: 'EGP' } {
  if (marketCurrency === 'JOD') {
    return { amountEgp: jodToEgp(displayMoney, jodToEgpRate), currency: 'EGP' };
  }
  return { amountEgp: Math.round(displayMoney), currency: 'EGP' };
}
