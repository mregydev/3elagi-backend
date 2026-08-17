import { MigrationInterface, QueryRunner } from 'typeorm';

/** Egypt 2 USD, Jordan 15 USD, international 50 USD per credit. */
export class PointPricingUsdRates1778541000000 implements MigrationInterface {
  name = 'PointPricingUsdRates1778541000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "point_pricing"
      SET "currency" = 'USD', "price_per_point" = 2, "updated_at" = now()
      WHERE "market" = 'EG'
    `);
    await queryRunner.query(`
      UPDATE "point_pricing"
      SET "currency" = 'USD', "price_per_point" = 15, "updated_at" = now()
      WHERE "market" = 'JO'
    `);
    await queryRunner.query(`
      UPDATE "point_pricing"
      SET "currency" = 'USD', "price_per_point" = 50, "updated_at" = now()
      WHERE "market" = 'INTL'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "point_pricing"
      SET "currency" = 'EGP', "price_per_point" = 100, "updated_at" = now()
      WHERE "market" = 'EG'
    `);
    await queryRunner.query(`
      UPDATE "point_pricing"
      SET "currency" = 'JOD', "price_per_point" = 10, "updated_at" = now()
      WHERE "market" = 'JO'
    `);
    await queryRunner.query(`
      UPDATE "point_pricing"
      SET "currency" = 'USD', "price_per_point" = 5, "updated_at" = now()
      WHERE "market" = 'INTL'
    `);
  }
}
