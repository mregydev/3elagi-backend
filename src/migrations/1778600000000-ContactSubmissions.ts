import { MigrationInterface, QueryRunner } from 'typeorm';

export class ContactSubmissions1778600000000 implements MigrationInterface {
  name = 'ContactSubmissions1778600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "contact_submissions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid,
        "sender_name" varchar(255) NOT NULL,
        "sender_email" varchar(255),
        "sender_role" varchar(32),
        "message" text NOT NULL,
        "attachments" jsonb NOT NULL DEFAULT '[]',
        "read_at" TIMESTAMPTZ,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_contact_submissions" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_contact_submissions_created_at"
      ON "contact_submissions" ("created_at" DESC)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_contact_submissions_read_at"
      ON "contact_submissions" ("read_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "contact_submissions"`);
  }
}
