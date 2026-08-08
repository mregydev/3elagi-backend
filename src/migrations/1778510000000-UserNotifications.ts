import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserNotifications1778510000000 implements MigrationInterface {
  name = 'UserNotifications1778510000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "user_notifications" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "type" character varying(48) NOT NULL,
        "title" character varying(160) NOT NULL,
        "body" text NOT NULL,
        "data" jsonb NOT NULL DEFAULT '{}',
        "read_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_notifications" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_user_notifications_user_created"
      ON "user_notifications" ("user_id", "created_at")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_user_notifications_user_read"
      ON "user_notifications" ("user_id", "read_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_user_notifications_user_read"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_user_notifications_user_created"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "user_notifications"`);
  }
}
