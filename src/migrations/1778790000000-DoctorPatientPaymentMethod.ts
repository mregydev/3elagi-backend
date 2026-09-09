import { MigrationInterface, QueryRunner } from 'typeorm';

export class DoctorPatientPaymentMethod1778790000000
  implements MigrationInterface
{
  name = 'DoctorPatientPaymentMethod1778790000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "doctors"
      ADD COLUMN IF NOT EXISTS "patient_payment_method" varchar(16) NOT NULL DEFAULT 'bank'
    `);
    await queryRunner.query(`
      UPDATE "doctors"
      SET "patient_payment_method" = 'wallet'
      WHERE COALESCE(TRIM("payment_link"), '') <> ''
        AND COALESCE(TRIM("iban"), '') = ''
        AND COALESCE(TRIM("account_holder_full_name"), '') = ''
    `);
    await queryRunner.query(`
      ALTER TABLE "doctors"
      DROP CONSTRAINT IF EXISTS "CHK_doctors_patient_payment_method"
    `);
    await queryRunner.query(`
      ALTER TABLE "doctors"
      ADD CONSTRAINT "CHK_doctors_patient_payment_method"
      CHECK ("patient_payment_method" IN ('bank', 'wallet'))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "doctors"
      DROP CONSTRAINT IF EXISTS "CHK_doctors_patient_payment_method"
    `);
    await queryRunner.query(`
      ALTER TABLE "doctors"
      DROP COLUMN IF EXISTS "patient_payment_method"
    `);
  }
}
