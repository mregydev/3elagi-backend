import { MigrationInterface, QueryRunner } from 'typeorm';

export class VideoCallSessions1778230000000 implements MigrationInterface {
  name = 'VideoCallSessions1778230000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "video_call_sessions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "patient_user_id" uuid NOT NULL,
        "doctor_user_id" uuid NOT NULL,
        "room_url" text NOT NULL,
        "status" varchar(16) NOT NULL DEFAULT 'ringing',
        "patient_name" text NOT NULL,
        "doctor_name" text NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_video_call_sessions" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_video_call_sessions_doctor_status"
      ON "video_call_sessions" ("doctor_user_id", "status")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "video_call_sessions"`);
  }
}
