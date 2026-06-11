import { MigrationInterface, QueryRunner } from 'typeorm';

export class AiAssistant1778120000000 implements MigrationInterface {
  name = 'AiAssistant1778120000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS vector`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "ai_knowledge_chunks" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "entity_type" varchar(64) NOT NULL,
        "entity_id" varchar(128) NOT NULL,
        "patient_id" uuid NULL,
        "doctor_id" uuid NULL,
        "text" text NOT NULL,
        "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "embedding" vector(768),
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT "PK_ai_knowledge_chunks" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_ai_knowledge_entity" ON "ai_knowledge_chunks" ("entity_type", "entity_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_ai_knowledge_patient" ON "ai_knowledge_chunks" ("patient_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_ai_knowledge_doctor" ON "ai_knowledge_chunks" ("doctor_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_ai_knowledge_embedding" ON "ai_knowledge_chunks" USING ivfflat ("embedding" vector_cosine_ops) WITH (lists = 100)`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "ai_conversations" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "patient_context_id" uuid NULL,
        "title" varchar(255) NOT NULL DEFAULT 'New chat',
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT "PK_ai_conversations" PRIMARY KEY ("id"),
        CONSTRAINT "FK_ai_conversations_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_ai_conversations_user" ON "ai_conversations" ("user_id", "updated_at" DESC)`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "ai_messages" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "conversation_id" uuid NOT NULL,
        "role" varchar(16) NOT NULL,
        "content" text NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT "PK_ai_messages" PRIMARY KEY ("id"),
        CONSTRAINT "FK_ai_messages_conversation" FOREIGN KEY ("conversation_id") REFERENCES "ai_conversations"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_ai_messages_conversation" ON "ai_messages" ("conversation_id", "created_at")`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "ai_usage_logs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "user_role" varchar(32) NOT NULL,
        "conversation_id" uuid NULL,
        "question" text NOT NULL,
        "tokens_estimated" int NULL,
        "cache_hit" boolean NOT NULL DEFAULT false,
        "latency_ms" int NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT "PK_ai_usage_logs" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_ai_usage_logs_user" ON "ai_usage_logs" ("user_id", "created_at" DESC)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "ai_usage_logs"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "ai_messages"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "ai_conversations"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "ai_knowledge_chunks"`);
  }
}
