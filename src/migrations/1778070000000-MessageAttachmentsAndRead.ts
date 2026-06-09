import { MigrationInterface, QueryRunner } from 'typeorm';

export class MessageAttachmentsAndRead1778070000000
  implements MigrationInterface
{
  name = 'MessageAttachmentsAndRead1778070000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "messages"
      ADD COLUMN IF NOT EXISTS "type" varchar(32) NOT NULL DEFAULT 'text',
      ADD COLUMN IF NOT EXISTS "attachment_url" text,
      ADD COLUMN IF NOT EXISTS "attachment_meta" jsonb,
      ADD COLUMN IF NOT EXISTS "read_at" TIMESTAMPTZ
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_messages_unread" ON "messages" ("recipient", "creator", "read_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_messages_unread"`);
    await queryRunner.query(`
      ALTER TABLE "messages"
      DROP COLUMN IF EXISTS "type",
      DROP COLUMN IF EXISTS "attachment_url",
      DROP COLUMN IF EXISTS "attachment_meta",
      DROP COLUMN IF EXISTS "read_at"
    `);
  }
}
