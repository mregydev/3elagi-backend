import { MigrationInterface, QueryRunner } from 'typeorm';

export class DoctorRegistrationRequests1778610000000
  implements MigrationInterface
{
  name = 'DoctorRegistrationRequests1778610000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "doctor_registration_requests" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "doctor_name" varchar(255) NOT NULL,
        "email" varchar(255) NOT NULL,
        "phone" varchar(64) NOT NULL,
        "speciality_id" uuid NOT NULL,
        "speciality_name_en" varchar(255) NOT NULL,
        "speciality_name_ar" varchar(255) NOT NULL,
        "read_at" TIMESTAMPTZ,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_doctor_registration_requests" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_doctor_registration_requests_created_at"
      ON "doctor_registration_requests" ("created_at" DESC)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_doctor_registration_requests_read_at"
      ON "doctor_registration_requests" ("read_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TABLE IF EXISTS "doctor_registration_requests"`,
    );
  }
}
