import { MigrationInterface, QueryRunner } from 'typeorm';

export class AdminAndIntakeSimplify1777860000000 implements MigrationInterface {
  name = 'AdminAndIntakeSimplify1777860000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Add 'admin' to UserRole enum (idempotent)
    await queryRunner.query(
      `ALTER TYPE "users_role_enum" ADD VALUE IF NOT EXISTS 'admin'`,
    );

    // 2. intake_tests: make doctor_id nullable + add is_default_template
    await queryRunner.query(
      `ALTER TABLE "intake_tests" ALTER COLUMN "doctor_id" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "intake_tests" ADD COLUMN IF NOT EXISTS "is_default_template" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_intake_default_template" ON "intake_tests" ("is_default_template") WHERE "is_default_template" = true`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_intake_default_template"`);
    await queryRunner.query(
      `ALTER TABLE "intake_tests" DROP COLUMN IF EXISTS "is_default_template"`,
    );
    // Cannot easily drop nullable change; leave as-is.
  }
}
