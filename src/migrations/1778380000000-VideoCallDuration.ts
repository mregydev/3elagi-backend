import { MigrationInterface, QueryRunner } from 'typeorm';

export class VideoCallDuration1778380000000 implements MigrationInterface {
  name = 'VideoCallDuration1778380000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "video_call_sessions"
      ADD COLUMN IF NOT EXISTS "duration_minutes" integer NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "video_call_sessions"
      DROP COLUMN IF EXISTS "duration_minutes"
    `);
  }
}
