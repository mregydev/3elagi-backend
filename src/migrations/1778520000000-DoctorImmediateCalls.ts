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
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "video_call_sessions" DROP COLUMN IF EXISTS "reserved_points"
    `);
    await queryRunner.query(`
      ALTER TABLE "doctors" DROP COLUMN IF EXISTS "immediate_call_enabled"
    `);
  }
}
