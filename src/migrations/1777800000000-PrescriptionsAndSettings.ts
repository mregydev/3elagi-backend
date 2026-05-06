import { MigrationInterface, QueryRunner } from 'typeorm';

export class PrescriptionsAndSettings1777800000000 implements MigrationInterface {
  name = 'PrescriptionsAndSettings1777800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add new columns to doctors
    await queryRunner.query(`
      ALTER TABLE "doctors"
      ADD COLUMN IF NOT EXISTS "digital_signature_url" character varying,
      ADD COLUMN IF NOT EXISTS "personal_clinic_location" character varying
    `);

    // Create prescriptions table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "prescriptions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "doctor_id" uuid NOT NULL,
        "patient_id" uuid NOT NULL,
        "clinic_id" uuid,
        "title" character varying NOT NULL,
        "symptoms" text,
        "items" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "pdf_url" character varying,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_prescriptions" PRIMARY KEY ("id"),
        CONSTRAINT "FK_prescriptions_doctor" FOREIGN KEY ("doctor_id") REFERENCES "doctors"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_prescriptions_patient" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_prescriptions_clinic" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_prescriptions_doctor_title" ON "prescriptions" ("doctor_id", "title")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_prescriptions_patient" ON "prescriptions" ("patient_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_prescriptions_patient"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_prescriptions_doctor_title"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "prescriptions"`);
    await queryRunner.query(`
      ALTER TABLE "doctors"
      DROP COLUMN IF EXISTS "digital_signature_url",
      DROP COLUMN IF EXISTS "personal_clinic_location"
    `);
  }
}
