import { MigrationInterface, QueryRunner } from 'typeorm';

export class DoctorCertifications1778270000000 implements MigrationInterface {
  name = 'DoctorCertifications1778270000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "doctors"
      ADD COLUMN IF NOT EXISTS "certification_urls" jsonb NOT NULL DEFAULT '[]'::jsonb
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "doctors"
      DROP COLUMN IF EXISTS "certification_urls"
    `);
  }
}
