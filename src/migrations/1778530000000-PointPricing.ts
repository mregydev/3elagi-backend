import { MigrationInterface, QueryRunner } from 'typeorm';

export class PointPricing1778530000000 implements MigrationInterface {
  name = 'PointPricing1778530000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "point_pricing" (
        "market" varchar(8) NOT NULL,
        "currency" varchar(3) NOT NULL,
        "price_per_point" numeric(12,2) NOT NULL,
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_point_pricing" PRIMARY KEY ("market")
      )
    `);
    // Launch prices; admins can change them from the dashboard afterwards.
    await queryRunner.query(`
      INSERT INTO "point_pricing" ("market", "currency", "price_per_point")
      VALUES ('EG', 'EGP', 100), ('JO', 'JOD', 10), ('INTL', 'USD', 5)
      ON CONFLICT ("market") DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "point_pricing"`);
  }
}
