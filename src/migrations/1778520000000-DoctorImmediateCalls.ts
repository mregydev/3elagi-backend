import { MigrationInterface, QueryRunner } from 'typeorm';

export class DoctorImmediateCalls1778520000000 implements MigrationInterface {
  name = 'DoctorImmediateCalls1778520000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "doctors"
      ADD COLUMN IF NOT EXISTS "immediate_call_enabled" boolean NOT NULL DEFAULT false
    `);
    await queryRunner.query(`
      ALTER TABLE "video_call_sessions"
      ADD COLUMN IF NOT EXISTS "reserved_points" integer NOT NULL DEFAULT 0
    `);
    // One live call per doctor: at most one ringing/accepted session at a time.
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_video_call_sessions_doctor_live"
      ON "video_call_sessions" ("doctor_user_id")
      WHERE "status" IN ('ringing', 'accepted')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "UQ_video_call_sessions_doctor_live"
    `);
    await queryRunner.query(`
      ALTER TABLE "video_call_sessions" DROP COLUMN IF EXISTS "reserved_points"
    `);
    await queryRunner.query(`
      ALTER TABLE "doctors" DROP COLUMN IF EXISTS "immediate_call_enabled"
    `);
  }
}
