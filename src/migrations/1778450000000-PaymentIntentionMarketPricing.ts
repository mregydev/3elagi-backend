import { MigrationInterface, QueryRunner } from 'typeorm';

export class PaymentIntentionMarketPricing1778450000000
  implements MigrationInterface
{
  name = 'PaymentIntentionMarketPricing1778450000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "payment_intentions"
      ADD COLUMN IF NOT EXISTS "currency" character varying(3) NOT NULL DEFAULT 'EGP'
    `);
    await queryRunner.query(`
      ALTER TABLE "payment_intentions"
      ADD COLUMN IF NOT EXISTS "amount_money" integer
    `);
    // Legacy rows were 1 credit = 1 EGP charged.
    await queryRunner.query(`
      UPDATE "payment_intentions"
      SET "amount_money" = "amount_egp",
          "currency" = COALESCE(NULLIF(TRIM("currency"), ''), 'EGP')
      WHERE "amount_money" IS NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "payment_intentions"
      ALTER COLUMN "amount_money" SET NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "payment_intentions"
      DROP COLUMN IF EXISTS "amount_money"
    `);
    await queryRunner.query(`
      ALTER TABLE "payment_intentions"
      DROP COLUMN IF EXISTS "currency"
    `);
  }
}
