import { MigrationInterface, QueryRunner } from 'typeorm';

export class MessagesTable1778060000000 implements MigrationInterface {
  name = 'MessagesTable1778060000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "messages" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "content" text NOT NULL,
        "creator" uuid NOT NULL,
        "recipient" uuid NOT NULL,
        "datetime" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT "PK_messages" PRIMARY KEY ("id"),
        CONSTRAINT "FK_messages_creator" FOREIGN KEY ("creator") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_messages_recipient" FOREIGN KEY ("recipient") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_messages_creator_recipient" ON "messages" ("creator", "recipient")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_messages_recipient_creator" ON "messages" ("recipient", "creator")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_messages_datetime" ON "messages" ("datetime" DESC)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "messages"`);
  }
}
