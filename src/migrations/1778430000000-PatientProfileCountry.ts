import { MigrationInterface, QueryRunner } from 'typeorm';

export class PatientProfileCountry1778430000000 implements MigrationInterface {
  name = 'PatientProfileCountry1778430000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "patient_profiles"
      ADD COLUMN IF NOT EXISTS "country" varchar(2) NOT NULL DEFAULT 'EG'
    `);
    await queryRunner.query(`
      UPDATE "patient_profiles"
      SET "country" = 'EG'
      WHERE "country" IS NULL OR TRIM("country") = ''
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "patient_profiles"
      DROP COLUMN IF EXISTS "country"
    `);
  }
}
