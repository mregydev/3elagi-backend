import { MigrationInterface, QueryRunner } from 'typeorm';

export class Consultations1778280000000 implements MigrationInterface {
  name = 'Consultations1778280000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "points_reserved" integer NOT NULL DEFAULT 0
    `);
    await queryRunner.query(`
      ALTER TABLE "doctors"
      ADD COLUMN IF NOT EXISTS "consultation_price" integer NOT NULL DEFAULT 10
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "consultations" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "patient_id" uuid NOT NULL,
        "doctor_id" uuid NOT NULL,
        "status" character varying(16) NOT NULL DEFAULT 'open',
        "description" text NOT NULL DEFAULT '',
        "reserved_points" integer NOT NULL DEFAULT 0,
        "doctor_note" text,
        "diagnosis_id" uuid,
        "cancel_reason_type" character varying(32),
        "cancel_reason" text,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "closed_at" TIMESTAMPTZ,
        CONSTRAINT "PK_consultations" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_consultations_patient" ON "consultations" ("patient_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_consultations_doctor" ON "consultations" ("doctor_id")`,
    );
    // At most one open consultation per patient-doctor pair.
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_consultations_open_pair"
      ON "consultations" ("patient_id", "doctor_id")
      WHERE "status" = 'open'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "consultations"`);
    await queryRunner.query(`ALTER TABLE "doctors" DROP COLUMN IF EXISTS "consultation_price"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "points_reserved"`);
  }
}
