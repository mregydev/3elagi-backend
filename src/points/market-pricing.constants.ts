import {
  normalizeMarketCountry,
  type MarketCountryCode,
} from '../common/patient-countries';

export type MarketCurrency = 'EGP' | 'JOD';

export interface MarketPointPricing {
  market: MarketCountryCode;
  currency: MarketCurrency;
  /** Cash charged per 1 credit/point. */
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

export function resolveMarketPricing(
  country?: string | null,
): MarketPointPricing {
  return MARKET_POINT_PRICING[normalizeMarketCountry(country)];
}

/** Cash to charge for buying `points` in the given market. */
export function moneyForPoints(
  points: number,
  country?: string | null,
): number {
  const pricing = resolveMarketPricing(country);
  return Math.round(points) * pricing.pricePerPoint;
}
