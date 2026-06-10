import { MigrationInterface, QueryRunner } from 'typeorm';

export class DoctorPatientAccess1778090000000 implements MigrationInterface {
  name = 'DoctorPatientAccess1778090000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "doctor_patient_access" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "patient_user_id" uuid NOT NULL,
        "doctor_id" uuid NOT NULL,
        "records_allowed" boolean NOT NULL DEFAULT false,
        "blocked_by_patient" boolean NOT NULL DEFAULT false,
        "blocked_by_doctor" boolean NOT NULL DEFAULT false,
        "records_allowed_at" TIMESTAMPTZ NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT "PK_doctor_patient_access" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_doctor_patient_access_pair" UNIQUE ("patient_user_id", "doctor_id"),
        CONSTRAINT "FK_doctor_patient_access_patient_user" FOREIGN KEY ("patient_user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_doctor_patient_access_doctor" FOREIGN KEY ("doctor_id") REFERENCES "doctors"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_doctor_patient_access_patient" ON "doctor_patient_access" ("patient_user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_doctor_patient_access_doctor" ON "doctor_patient_access" ("doctor_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "doctor_patient_access"`);
  }
}
