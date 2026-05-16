import { MigrationInterface, QueryRunner } from 'typeorm';

export class DiagnosisAndSymptoms1777940000000 implements MigrationInterface {
  name = 'DiagnosisAndSymptoms1777940000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "diagnoses" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "desc" text NOT NULL,
        "patient_id" uuid NOT NULL,
        "doctor_id" uuid NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_diagnoses" PRIMARY KEY ("id"),
        CONSTRAINT "FK_diagnoses_patient" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_diagnoses_doctor" FOREIGN KEY ("doctor_id") REFERENCES "doctors"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_diagnoses_patient" ON "diagnoses" ("patient_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_diagnoses_doctor" ON "diagnoses" ("doctor_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "symptoms" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "desc" text NOT NULL,
        "diagnosis_id" uuid NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_symptoms" PRIMARY KEY ("id"),
        CONSTRAINT "FK_symptoms_diagnosis" FOREIGN KEY ("diagnosis_id") REFERENCES "diagnoses"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_symptoms_diagnosis" ON "symptoms" ("diagnosis_id")`,
    );

    await queryRunner.query(`
      ALTER TABLE "medical_documents"
      ADD COLUMN IF NOT EXISTS "diagnosis_id" uuid,
      ADD COLUMN IF NOT EXISTS "symptom_id" uuid
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "medical_documents"
        ADD CONSTRAINT "FK_medical_documents_diagnosis"
        FOREIGN KEY ("diagnosis_id") REFERENCES "diagnoses"("id") ON DELETE SET NULL;
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "medical_documents"
        ADD CONSTRAINT "FK_medical_documents_symptom"
        FOREIGN KEY ("symptom_id") REFERENCES "symptoms"("id") ON DELETE SET NULL;
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "medical_documents"
      DROP CONSTRAINT IF EXISTS "FK_medical_documents_symptom",
      DROP CONSTRAINT IF EXISTS "FK_medical_documents_diagnosis",
      DROP COLUMN IF EXISTS "symptom_id",
      DROP COLUMN IF EXISTS "diagnosis_id"
    `);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_symptoms_diagnosis"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "symptoms"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_diagnoses_doctor"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_diagnoses_patient"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "diagnoses"`);
  }
}
