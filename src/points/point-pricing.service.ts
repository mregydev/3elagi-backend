import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  PointPricing,
  type MarketCurrency,
  type PointMarket,
} from '../entities/point-pricing.entity';
import {
  MARKET_POINT_PRICING,
  resolvePointMarket,
  type MarketPointPricing,
} from './market-pricing.constants';

/** Currency is fixed per market; only the price is admin-editable. */
const MARKET_CURRENCY: Record<PointMarket, MarketCurrency> = {
  EG: 'USD',
  JO: 'USD',
  INTL: 'USD',
};

@Injectable()
export class PointPricingService {
  private readonly logger = new Logger(PointPricingService.name);
  /** Prices change rarely and are read on every checkout — cache briefly. */
  private cache: { at: number; rows: Record<PointMarket, number> } | null = null;
  private static readonly CACHE_MS = 60_000;

  constructor(
    @InjectRepository(PointPricing)
    private readonly repo: Repository<PointPricing>,
  ) {}

  private fallbackPrice(market: PointMarket): number {
    return MARKET_POINT_PRICING[market].pricePerPoint;
  }

  private async load(): Promise<Record<PointMarket, number>> {
    const fresh = this.cache && Date.now() - this.cache.at < PointPricingService.CACHE_MS;
    if (fresh && this.cache) return this.cache.rows;

    const rows: Record<PointMarket, number> = {
      EG: this.fallbackPrice('EG'),
      JO: this.fallbackPrice('JO'),
      INTL: this.fallbackPrice('INTL'),
    };
    try {
      for (const row of await this.repo.find()) {
        const price = Number(row.price_per_point);
        if (Number.isFinite(price) && price > 0) rows[row.market] = price;
      }
    } catch (err) {
      // Table missing (migration not run yet) — the launch prices still work.
      this.logger.warn(`Falling back to built-in point prices: ${String(err)}`);
    }
    this.cache = { at: Date.now(), rows };
    return rows;
  }

  /** Pricing for a country code (EG / JO / anything else). */
  async resolve(country?: string | null): Promise<MarketPointPricing> {
    const market = resolvePointMarket(country);
    const rows = await this.load();
    return { ...MARKET_POINT_PRICING[market], pricePerPoint: rows[market] };
  }

  /** All three markets, for the admin screen. */
  async list(): Promise<MarketPointPricing[]> {
    const rows = await this.load();
    return (Object.keys(MARKET_CURRENCY) as PointMarket[]).map((market) => ({
      ...MARKET_POINT_PRICING[market],
      pricePerPoint: rows[market],
    }));
  }

  async setPrice(
    market: PointMarket,
    pricePerPoint: number,
  ): Promise<MarketPointPricing> {
    if (!MARKET_CURRENCY[market]) {
      throw new BadRequestException('Unknown market');
    }
    if (!Number.isFinite(pricePerPoint) || pricePerPoint <= 0) {
      throw new BadRequestException('Price per point must be greater than zero');
    }
    await this.repo.save({
      market,
      currency: MARKET_CURRENCY[market],
      price_per_point: pricePerPoint.toFixed(2),
    });
    this.cache = null;
    return { ...MARKET_POINT_PRICING[market], pricePerPoint };
  }
}
