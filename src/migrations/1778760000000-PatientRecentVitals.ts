import { MigrationInterface, QueryRunner } from 'typeorm';

export class PatientRecentVitals1778760000000 implements MigrationInterface {
  name = 'PatientRecentVitals1778760000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "patient_profiles"
      ADD COLUMN IF NOT EXISTS "recent_vitals" jsonb NOT NULL DEFAULT '{}'::jsonb
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "patient_profiles"
      DROP COLUMN IF EXISTS "recent_vitals"
    `);
  }
}
