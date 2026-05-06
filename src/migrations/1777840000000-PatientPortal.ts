import { MigrationInterface, QueryRunner } from 'typeorm';

export class PatientPortal1777840000000 implements MigrationInterface {
  name = 'PatientPortal1777840000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "patient_profiles" (
        "user_id" uuid NOT NULL,
        "name" varchar NOT NULL,
        "phone" varchar NOT NULL,
        "birth_date" date,
        "gender" varchar,
        "chronic_conditions" text,
        "allergies" text,
        "medical_notes" text,
        "onboarded_at" TIMESTAMP,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_patient_profiles" PRIMARY KEY ("user_id"),
        CONSTRAINT "FK_patient_profiles_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "doctor_schedules" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "doctor_id" uuid NOT NULL,
        "day_of_week" smallint NOT NULL,
        "start_time" time NOT NULL,
        "end_time" time NOT NULL,
        "slot_minutes" integer NOT NULL DEFAULT 15,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_doctor_schedules" PRIMARY KEY ("id"),
        CONSTRAINT "FK_doctor_schedules_doctor" FOREIGN KEY ("doctor_id")
          REFERENCES "doctors"("id") ON DELETE CASCADE,
        CONSTRAINT "CK_doctor_schedules_day" CHECK ("day_of_week" BETWEEN 0 AND 6)
      );
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_doctor_schedules_doctor" ON "doctor_schedules"("doctor_id")`,
    );

    await queryRunner.query(
      `ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "intake_test_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "intake_answers" jsonb`,
    );
    await queryRunner.query(
      `ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "booked_via_app" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "patient_user_id" uuid`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_appointments_patient_user" ON "appointments"("patient_user_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_appointments_patient_user"`);
    await queryRunner.query(`ALTER TABLE "appointments" DROP COLUMN IF EXISTS "patient_user_id"`);
    await queryRunner.query(`ALTER TABLE "appointments" DROP COLUMN IF EXISTS "booked_via_app"`);
    await queryRunner.query(`ALTER TABLE "appointments" DROP COLUMN IF EXISTS "intake_answers"`);
    await queryRunner.query(`ALTER TABLE "appointments" DROP COLUMN IF EXISTS "intake_test_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_doctor_schedules_doctor"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "doctor_schedules"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "patient_profiles"`);
  }
}
