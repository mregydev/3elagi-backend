import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserMessagePoints1778100000000 implements MigrationInterface {
  name = 'UserMessagePoints1778100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "message_points" integer NOT NULL DEFAULT 20,
      ADD COLUMN IF NOT EXISTS "points_spent_total" integer NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "points_purchased_total" integer NOT NULL DEFAULT 0
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      DROP COLUMN IF EXISTS "points_purchased_total",
      DROP COLUMN IF EXISTS "points_spent_total",
      DROP COLUMN IF EXISTS "message_points"
    `);
  }
}
