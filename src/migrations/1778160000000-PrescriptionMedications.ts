import { MigrationInterface, QueryRunner } from 'typeorm';

export class PrescriptionMedications1778160000000 implements MigrationInterface {
  name = 'PrescriptionMedications1778160000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "prescriptions"
      ADD COLUMN IF NOT EXISTS "patient_user_id" uuid
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "prescriptions"
        ADD CONSTRAINT "FK_prescriptions_patient_user"
        FOREIGN KEY ("patient_user_id") REFERENCES "users"("id") ON DELETE CASCADE;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await queryRunner.query(`
      ALTER TABLE "prescriptions"
      ALTER COLUMN "patient_id" DROP NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "prescriptions"
      ALTER COLUMN "doctor_id" DROP NOT NULL
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "prescription_medications" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "prescription_id" uuid NOT NULL,
        "medication_name" character varying NOT NULL,
        "interval" character varying,
        "dose" character varying,
        "notes" text,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_prescription_medications" PRIMARY KEY ("id"),
        CONSTRAINT "FK_prescription_medications_prescription"
          FOREIGN KEY ("prescription_id") REFERENCES "prescriptions"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_prescription_medications_prescription"
      ON "prescription_medications" ("prescription_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_prescriptions_patient_user"
      ON "prescriptions" ("patient_user_id")
    `);

    await queryRunner.query(`
      INSERT INTO "prescription_medications" (
        "prescription_id",
        "medication_name",
        "interval",
        "dose",
        "notes"
      )
      SELECT
        p.id,
        COALESCE(item->>'name', ''),
        NULLIF(item->>'frequency', ''),
        NULLIF(item->>'dose', ''),
        NULLIF(item->>'notes', '')
      FROM "prescriptions" p
      CROSS JOIN LATERAL jsonb_array_elements(COALESCE(p.items, '[]'::jsonb)) AS item
      WHERE jsonb_array_length(COALESCE(p.items, '[]'::jsonb)) > 0
        AND COALESCE(item->>'name', '') <> ''
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_prescriptions_patient_user"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_prescription_medications_prescription"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "prescription_medications"`);
    await queryRunner.query(`
      ALTER TABLE "prescriptions" DROP CONSTRAINT IF EXISTS "FK_prescriptions_patient_user"
    `);
    await queryRunner.query(`
      ALTER TABLE "prescriptions" DROP COLUMN IF EXISTS "patient_user_id"
    `);
  }
}
