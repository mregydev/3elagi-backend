import { MigrationInterface, QueryRunner } from 'typeorm';

export class AdminRagSources1778250000000 implements MigrationInterface {
  name = 'AdminRagSources1778250000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "admin_rag_sources" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "kind" varchar(16) NOT NULL,
        "title" varchar(255) NOT NULL,
        "content" text NOT NULL,
        "file_url" text,
        "file_name" varchar(255),
        "mime_type" varchar(160),
        "created_by" uuid,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT "PK_admin_rag_sources" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_admin_rag_sources_created_at" ON "admin_rag_sources" ("created_at" DESC)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "admin_rag_sources"`);
  }
}
