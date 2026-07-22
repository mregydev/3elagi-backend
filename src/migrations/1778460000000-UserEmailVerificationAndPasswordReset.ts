import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserEmailVerificationAndPasswordReset1778460000000
  implements MigrationInterface
{
  name = 'UserEmailVerificationAndPasswordReset1778460000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "email_verified_at" TIMESTAMPTZ NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "email_verification_code_hash" character varying NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "email_verification_expires_at" TIMESTAMPTZ NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "password_reset_token_hash" character varying NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "password_reset_expires_at" TIMESTAMPTZ NULL
    `);
    // Existing accounts are treated as already verified.
    await queryRunner.query(`
      UPDATE "users"
      SET "email_verified_at" = COALESCE("created_at", NOW())
      WHERE "email_verified_at" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users" DROP COLUMN IF EXISTS "password_reset_expires_at"
    `);
    await queryRunner.query(`
      ALTER TABLE "users" DROP COLUMN IF EXISTS "password_reset_token_hash"
    `);
    await queryRunner.query(`
      ALTER TABLE "users" DROP COLUMN IF EXISTS "email_verification_expires_at"
    `);
    await queryRunner.query(`
      ALTER TABLE "users" DROP COLUMN IF EXISTS "email_verification_code_hash"
    `);
    await queryRunner.query(`
      ALTER TABLE "users" DROP COLUMN IF EXISTS "email_verified_at"
    `);
  }
}
