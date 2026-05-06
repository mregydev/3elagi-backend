import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIsPersonalToClinic1777600000001 implements MigrationInterface {
  name = 'AddIsPersonalToClinic1777600000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "clinics"
      ADD COLUMN IF NOT EXISTS "is_personal" boolean NOT NULL DEFAULT false
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "clinics" DROP COLUMN IF EXISTS "is_personal"
    `);
  }
}
