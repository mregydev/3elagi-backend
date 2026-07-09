import { MigrationInterface, QueryRunner } from 'typeorm';

export class VideoConsultationPrice1778330000000 implements MigrationInterface {
  name = 'VideoConsultationPrice1778330000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "doctors"
      ADD COLUMN IF NOT EXISTS "video_consultation_price" integer NOT NULL DEFAULT 1
    `);
    await queryRunner.query(`
      ALTER TABLE "appointments"
      ADD COLUMN IF NOT EXISTS "reserved_points" integer NOT NULL DEFAULT 0
    `);
    await queryRunner.query(`
      ALTER TABLE "appointments"
      ADD COLUMN IF NOT EXISTS "points_settled" boolean NOT NULL DEFAULT false
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "appointments" DROP COLUMN IF EXISTS "points_settled"
    `);
    await queryRunner.query(`
      ALTER TABLE "appointments" DROP COLUMN IF EXISTS "reserved_points"
    `);
    await queryRunner.query(`
      ALTER TABLE "doctors" DROP COLUMN IF EXISTS "video_consultation_price"
    `);
  }
}
