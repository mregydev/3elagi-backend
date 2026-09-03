import { MigrationInterface, QueryRunner } from 'typeorm';

export class DoctorSpecialityChangeRequests1778750000000
  implements MigrationInterface
{
  name = 'DoctorSpecialityChangeRequests1778750000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "doctor_speciality_change_requests" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "doctor_id" uuid NOT NULL,
        "doctor_user_id" uuid NOT NULL,
        "doctor_name" varchar(255) NOT NULL,
        "doctor_email" varchar(255),
        "current_speciality_id" uuid,
        "current_speciality_name_en" varchar(255),
        "current_speciality_name_ar" varchar(255),
        "requested_speciality_id" uuid NOT NULL,
        "requested_speciality_ids" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "requested_speciality_name_en" varchar(255) NOT NULL,
        "requested_speciality_name_ar" varchar(255) NOT NULL,
        "status" varchar(16) NOT NULL DEFAULT 'pending',
        "reviewed_at" TIMESTAMPTZ,
        "reviewed_by_user_id" uuid,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_doctor_speciality_change_requests" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_doctor_speciality_change_requests_status"
      ON "doctor_speciality_change_requests" ("status", "created_at" DESC)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_doctor_speciality_change_requests_doctor"
      ON "doctor_speciality_change_requests" ("doctor_id", "status")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TABLE IF EXISTS "doctor_speciality_change_requests"`,
    );
  }
}
