import { MigrationInterface, QueryRunner } from 'typeorm';

export class PatientMedicalRecordsConsent1778350000000
  implements MigrationInterface
{
  name = 'PatientMedicalRecordsConsent1778350000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "patient_profiles"
      ADD COLUMN IF NOT EXISTS "medical_records_storage_consent" boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS "medical_records_storage_consent_at" TIMESTAMP NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "patient_profiles"
      DROP COLUMN IF EXISTS "medical_records_storage_consent_at",
      DROP COLUMN IF EXISTS "medical_records_storage_consent"
    `);
  }
}
