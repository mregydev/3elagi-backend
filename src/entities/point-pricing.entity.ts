import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/** Egypt, Jordan, or everywhere else. */
export type PointMarket = 'EG' | 'JO' | 'INTL';
export type MarketCurrency = 'EGP' | 'JOD' | 'USD';

/**
 * Admin-editable cash price of one credit per market. Seeded with the launch
 * prices; `market` is the primary key so there is exactly one row per market.
 */
@Entity('point_pricing')
export class PointPricing {
  @PrimaryColumn({ type: 'varchar', length: 8 })
  market: PointMarket;

  @Column({ type: 'varchar', length: 3 })
  currency: MarketCurrency;

  /** Cash charged per 1 credit, in `currency`. */
  @Column({ type: 'numeric', precision: 12, scale: 2 })
  price_per_point: string;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
