import { MigrationInterface, QueryRunner } from 'typeorm';

export class DoctorWelcomePassword1778810000000 implements MigrationInterface {
  name = 'DoctorWelcomePassword1778810000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "doctors"
      ADD COLUMN IF NOT EXISTS "welcome_password" varchar(128) NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "doctors"
      DROP COLUMN IF EXISTS "welcome_password"
    `);
  }
}
