import type { MarketCountryCode } from '../common/patient-countries';
import { USD_PER_POINT } from './usd-point-rates.constants';

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

/** Top-up: Egypt 2 USD, Jordan 15 USD, rest of world 50 USD per point (IP-priced). */
export const MARKET_POINT_PRICING: Record<PointMarket, MarketPointPricing> = {
  EG: {
    market: 'EG',
    currency: 'USD',
    pricePerPoint: USD_PER_POINT.EG,
    billingCountry: 'EG',
    billingCity: 'Cairo',
  },
  JO: {
    market: 'JO',
    currency: 'USD',
    pricePerPoint: USD_PER_POINT.JO,
    billingCountry: 'JO',
    billingCity: 'Amman',
  },
  INTL: {
    market: 'INTL',
    currency: 'USD',
    pricePerPoint: USD_PER_POINT.INTL,
    billingCountry: 'EG',
    billingCity: 'Cairo',
  },
};

/**
 * EGP charged to Paymob per 1 USD of display price.
 * Override with env `USD_TO_EGP_RATE` (default 50).
 */
export const DEFAULT_USD_TO_EGP_RATE = 50;

/**
 * Legacy JOD → EGP parity kept for older rows still priced in JOD.
 * Override with env `JOD_TO_EGP_RATE`.
 */
export const DEFAULT_JOD_TO_EGP_RATE = 10;

/** Egypt, Jordan, or everywhere else (including unknown IP → international). */
export function resolvePointMarket(country?: string | null): PointMarket {
  const code = country?.trim().toUpperCase();
  if (code === 'EG') return 'EG';
  if (code === 'JO') return 'JO';
  return 'INTL';
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
