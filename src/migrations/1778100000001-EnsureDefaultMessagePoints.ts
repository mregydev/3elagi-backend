import { MigrationInterface, QueryRunner } from 'typeorm';

export class EnsureDefaultMessagePoints1778100000001 implements MigrationInterface {
  name = 'EnsureDefaultMessagePoints1778100000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      ALTER COLUMN "message_points" SET DEFAULT 20
    `);
    await queryRunner.query(`
      UPDATE "users"
      SET "message_points" = 20
      WHERE "message_points" IS NULL
    `);
    await queryRunner.query(`
      UPDATE "users"
      SET "points_spent_total" = 0
      WHERE "points_spent_total" IS NULL
    `);
    await queryRunner.query(`
      UPDATE "users"
      SET "points_purchased_total" = 0
      WHERE "points_purchased_total" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // no-op: keep user balances intact
  }
}
