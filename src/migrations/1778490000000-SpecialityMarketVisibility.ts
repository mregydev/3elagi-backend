import { MigrationInterface, QueryRunner } from 'typeorm';

export class SpecialityMarketVisibility1778490000000
  implements MigrationInterface
{
  name = 'SpecialityMarketVisibility1778490000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "doctor_specialities"
      ADD COLUMN IF NOT EXISTS "visible_eg" boolean NOT NULL DEFAULT true
    `);
    await queryRunner.query(`
      ALTER TABLE "doctor_specialities"
      ADD COLUMN IF NOT EXISTS "visible_jo" boolean NOT NULL DEFAULT true
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "doctor_specialities"
      DROP COLUMN IF EXISTS "visible_jo"
    `);
    await queryRunner.query(`
      ALTER TABLE "doctor_specialities"
      DROP COLUMN IF EXISTS "visible_eg"
    `);
  }
}
