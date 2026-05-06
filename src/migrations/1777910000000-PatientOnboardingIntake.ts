import { MigrationInterface, QueryRunner } from 'typeorm';

export class PatientOnboardingIntake1777910000000 implements MigrationInterface {
  name = 'PatientOnboardingIntake1777910000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "patient_profiles" ADD COLUMN IF NOT EXISTS "intake_test_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "patient_profiles" ADD COLUMN IF NOT EXISTS "intake_answers" jsonb NOT NULL DEFAULT '{}'::jsonb`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "patient_profiles" DROP COLUMN IF EXISTS "intake_answers"`,
    );
    await queryRunner.query(
      `ALTER TABLE "patient_profiles" DROP COLUMN IF EXISTS "intake_test_id"`,
    );
  }
}
