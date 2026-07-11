import { MigrationInterface, QueryRunner } from 'typeorm';

export class AiMessageAttachments1778340000000 implements MigrationInterface {
  name = 'AiMessageAttachments1778340000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "ai_messages"
      ADD COLUMN IF NOT EXISTS "attachment_url" text NULL,
      ADD COLUMN IF NOT EXISTS "attachment_mime_type" varchar(128) NULL,
      ADD COLUMN IF NOT EXISTS "attachment_file_name" varchar(255) NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "ai_messages"
      DROP COLUMN IF EXISTS "attachment_file_name",
      DROP COLUMN IF EXISTS "attachment_mime_type",
      DROP COLUMN IF EXISTS "attachment_url"
    `);
  }
}
