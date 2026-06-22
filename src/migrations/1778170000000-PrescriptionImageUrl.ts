import { MigrationInterface, QueryRunner } from 'typeorm';

export class PrescriptionImageUrl1778170000000 implements MigrationInterface {
  name = 'PrescriptionImageUrl1778170000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "prescriptions"
      ADD COLUMN IF NOT EXISTS "image_url" character varying
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "prescriptions"
      DROP COLUMN IF EXISTS "image_url"
    `);
  }
}
