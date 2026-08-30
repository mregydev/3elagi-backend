import { MigrationInterface, QueryRunner } from 'typeorm';

export class AppReviews1778630000000 implements MigrationInterface {
  name = 'AppReviews1778630000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "app_reviews" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "user_name" varchar(255) NOT NULL,
        "user_email" varchar(255),
        "user_role" varchar(32),
        "rating" int NOT NULL,
        "comment" text,
        "improvement_tags" jsonb NOT NULL DEFAULT '[]',
        "read_at" TIMESTAMPTZ,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_app_reviews" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_app_reviews_user_id"
      ON "app_reviews" ("user_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_app_reviews_created_at"
      ON "app_reviews" ("created_at" DESC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "app_reviews"`);
  }
}
