import { MigrationInterface, QueryRunner } from 'typeorm';

export class SymptomDoctorId1777990000000 implements MigrationInterface {
  name = 'SymptomDoctorId1777990000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "symptoms"
      ADD COLUMN IF NOT EXISTS "doctor_id" uuid
    `);
    await queryRunner.query(`
      UPDATE "symptoms" s
      SET "doctor_id" = d."doctor_id"
      FROM "diagnoses" d
      WHERE s."diagnosis_id" = d."id"
        AND d."doctor_id" IS NOT NULL
        AND s."doctor_id" IS NULL
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "symptoms"
        ADD CONSTRAINT "FK_symptoms_doctor"
        FOREIGN KEY ("doctor_id") REFERENCES "doctors"("id") ON DELETE SET NULL;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "symptoms"
      DROP CONSTRAINT IF EXISTS "FK_symptoms_doctor"
    `);
    await queryRunner.query(`
      ALTER TABLE "symptoms"
      DROP COLUMN IF EXISTS "doctor_id"
    `);
  }
}
