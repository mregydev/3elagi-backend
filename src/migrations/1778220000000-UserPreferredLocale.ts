import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserPreferredLocale1778220000000 implements MigrationInterface {
  name = 'UserPreferredLocale1778220000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "preferred_locale" varchar(2)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users" DROP COLUMN IF EXISTS "preferred_locale"
    `);
  }
}
