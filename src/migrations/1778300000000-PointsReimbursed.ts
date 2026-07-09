import { MigrationInterface, QueryRunner } from 'typeorm';

export class PointsReimbursed1778300000000 implements MigrationInterface {
  name = 'PointsReimbursed1778300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "points_reimbursed_total" integer NOT NULL DEFAULT 0`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "points_reimbursed_total"`,
    );
  }
}
