import { MigrationInterface, QueryRunner } from 'typeorm';

export class AppointmentChatFields1778240000000 implements MigrationInterface {
  name = 'AppointmentChatFields1778240000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "appointments"
      ADD COLUMN IF NOT EXISTS "meeting_link" text,
      ADD COLUMN IF NOT EXISTS "video_call_session_id" uuid,
      ADD COLUMN IF NOT EXISTS "reminder_sent_at" TIMESTAMPTZ
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "appointments"
      DROP COLUMN IF EXISTS "reminder_sent_at",
      DROP COLUMN IF EXISTS "video_call_session_id",
      DROP COLUMN IF EXISTS "meeting_link"
    `);
  }
}
