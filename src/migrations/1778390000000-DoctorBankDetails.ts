import { MigrationInterface, QueryRunner } from 'typeorm';

export class DoctorBankDetails1778390000000 implements MigrationInterface {
  name = 'DoctorBankDetails1778390000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "doctors"
      ADD COLUMN IF NOT EXISTS "iban" character varying(64) NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "doctors"
      ADD COLUMN IF NOT EXISTS "account_holder_full_name" character varying(200) NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "doctors"
      ADD COLUMN IF NOT EXISTS "national_id" character varying(32) NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "doctors" DROP COLUMN IF EXISTS "national_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "doctors" DROP COLUMN IF EXISTS "account_holder_full_name"
    `);
    await queryRunner.query(`
      ALTER TABLE "doctors" DROP COLUMN IF EXISTS "iban"
    `);
  }
}
