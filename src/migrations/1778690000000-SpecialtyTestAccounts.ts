import { MigrationInterface, QueryRunner } from 'typeorm';

export class SpecialtyTestAccounts1778690000000 implements MigrationInterface {
  name = 'SpecialtyTestAccounts1778690000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "specialty_test_accounts" (
        "speciality_id" UUID NOT NULL,
        "patient_user_id" UUID NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT "PK_specialty_test_accounts" PRIMARY KEY ("speciality_id"),
        CONSTRAINT "FK_specialty_test_accounts_speciality"
          FOREIGN KEY ("speciality_id") REFERENCES "doctor_specialities"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_specialty_test_accounts_patient"
          FOREIGN KEY ("patient_user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "patient_profiles"
      ADD COLUMN IF NOT EXISTS "is_specialty_test_account" BOOLEAN NOT NULL DEFAULT FALSE
    `);

    await queryRunner.query(`
      ALTER TABLE "doctors"
      ADD COLUMN IF NOT EXISTS "onboarding_test_patient_user_id" UUID NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "doctors"
      DROP COLUMN IF EXISTS "onboarding_test_patient_user_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "patient_profiles"
      DROP COLUMN IF EXISTS "is_specialty_test_account"
    `);
    await queryRunner.query(`DROP TABLE IF EXISTS "specialty_test_accounts"`);
  }
}
