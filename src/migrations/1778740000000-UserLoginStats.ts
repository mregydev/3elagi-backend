import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserLoginStats1778740000000 implements MigrationInterface {
  name = 'UserLoginStats1778740000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "user_login_stats" (
        "user_id" UUID NOT NULL,
        "email" VARCHAR(320) NOT NULL,
        "login_count" INTEGER NOT NULL DEFAULT 0,
        "last_login_at" TIMESTAMPTZ NULL,
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_login_stats" PRIMARY KEY ("user_id"),
        CONSTRAINT "FK_user_login_stats_user"
          FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_user_login_stats_login_count"
      ON "user_login_stats" ("login_count" DESC)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_user_login_stats_last_login_at"
      ON "user_login_stats" ("last_login_at" DESC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_user_login_stats_last_login_at"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_user_login_stats_login_count"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "user_login_stats"`);
  }
}
