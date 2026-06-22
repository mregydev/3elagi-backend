import { MigrationInterface, QueryRunner } from 'typeorm';

export class MessageEmotions1778130000000 implements MigrationInterface {
  name = 'MessageEmotions1778130000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "message_emotions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "message_id" uuid NOT NULL,
        "message_source" varchar(8) NOT NULL,
        "user_id" uuid NOT NULL,
        "emotion" varchar(16) NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT "PK_message_emotions" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_message_emotion_user" UNIQUE ("message_id", "message_source", "user_id"),
        CONSTRAINT "FK_message_emotions_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "CHK_message_emotions_source" CHECK ("message_source" IN ('chat', 'ai')),
        CONSTRAINT "CHK_message_emotions_type" CHECK ("emotion" IN ('love', 'like', 'laugh', 'thumbsup'))
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_message_emotions_message" ON "message_emotions" ("message_id", "message_source")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_message_emotions_user" ON "message_emotions" ("user_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "message_emotions"`);
  }
}
