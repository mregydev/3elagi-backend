import { MigrationInterface, QueryRunner } from 'typeorm';

export class ConsultationComplaints1778310000000 implements MigrationInterface {
  name = 'ConsultationComplaints1778310000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "doctors" ADD COLUMN IF NOT EXISTS "video_consultation_minutes" integer NOT NULL DEFAULT 30`,
    );
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "consultation_complaints" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "consultation_id" uuid NOT NULL,
        "patient_id" uuid NOT NULL,
        "doctor_id" uuid NOT NULL,
        "points" integer NOT NULL DEFAULT 0,
        "reason" text NOT NULL DEFAULT '',
        "status" character varying(16) NOT NULL DEFAULT 'pending',
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "resolved_at" TIMESTAMPTZ,
        CONSTRAINT "PK_consultation_complaints" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_consultation_complaints_status" ON "consultation_complaints" ("status")`,
    );
    // One complaint per consultation.
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_consultation_complaints_consultation" ON "consultation_complaints" ("consultation_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "consultation_complaints"`);
    await queryRunner.query(
      `ALTER TABLE "doctors" DROP COLUMN IF EXISTS "video_consultation_minutes"`,
    );
  }
}
