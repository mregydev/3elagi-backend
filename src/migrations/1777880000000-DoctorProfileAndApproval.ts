import { MigrationInterface, QueryRunner } from 'typeorm';

export class DoctorProfileAndApproval1777880000000
  implements MigrationInterface
{
  name = 'DoctorProfileAndApproval1777880000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "doctors" ADD COLUMN IF NOT EXISTS "professional_title" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "doctors" ADD COLUMN IF NOT EXISTS "description" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "doctors" ADD COLUMN IF NOT EXISTS "experience_years" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "doctors" ADD COLUMN IF NOT EXISTS "consultation_fee_egp" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "doctors" ADD COLUMN IF NOT EXISTS "approval_status" varchar(16) NOT NULL DEFAULT 'pending'`,
    );
    // Pre-existing doctors are grandfathered to approved.
    await queryRunner.query(
      `UPDATE "doctors" SET "approval_status" = 'approved' WHERE "created_at" < NOW() - INTERVAL '1 second'`,
    );

    await queryRunner.query(
      `ALTER TABLE "clinics" ADD COLUMN IF NOT EXISTS "approval_status" varchar(16) NOT NULL DEFAULT 'pending'`,
    );
    // Personal clinics auto-attach to a doctor and inherit doctor-level approval; pre-existing clinics grandfathered.
    await queryRunner.query(
      `UPDATE "clinics" SET "approval_status" = 'approved' WHERE "created_at" < NOW() - INTERVAL '1 second' OR "is_personal" = true`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "clinics" DROP COLUMN IF EXISTS "approval_status"`,
    );
    await queryRunner.query(
      `ALTER TABLE "doctors" DROP COLUMN IF EXISTS "approval_status"`,
    );
    await queryRunner.query(
      `ALTER TABLE "doctors" DROP COLUMN IF EXISTS "consultation_fee_egp"`,
    );
    await queryRunner.query(
      `ALTER TABLE "doctors" DROP COLUMN IF EXISTS "experience_years"`,
    );
    await queryRunner.query(
      `ALTER TABLE "doctors" DROP COLUMN IF EXISTS "description"`,
    );
    await queryRunner.query(
      `ALTER TABLE "doctors" DROP COLUMN IF EXISTS "professional_title"`,
    );
  }
}
