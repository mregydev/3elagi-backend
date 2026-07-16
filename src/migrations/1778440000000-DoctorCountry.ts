import { MigrationInterface, QueryRunner } from 'typeorm';

export class DoctorCountry1778440000000 implements MigrationInterface {
  name = 'DoctorCountry1778440000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "doctors"
      ADD COLUMN IF NOT EXISTS "country" varchar(2) NOT NULL DEFAULT 'EG'
    `);
    await queryRunner.query(`
      UPDATE "doctors"
      SET "country" = 'EG'
      WHERE "country" IS NULL OR TRIM("country") = ''
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "doctors"
      DROP COLUMN IF EXISTS "country"
    `);
  }
}
