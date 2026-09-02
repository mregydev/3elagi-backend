import { MigrationInterface, QueryRunner } from 'typeorm';

export class DoctorProductTour1778680000000 implements MigrationInterface {
  name = 'DoctorProductTour1778680000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "doctors"
      ADD COLUMN IF NOT EXISTS "product_tour_completed_at" TIMESTAMPTZ NULL,
      ADD COLUMN IF NOT EXISTS "profile_tour_completed_at" TIMESTAMPTZ NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "doctors"
      DROP COLUMN IF EXISTS "product_tour_completed_at",
      DROP COLUMN IF EXISTS "profile_tour_completed_at"
    `);
  }
}
