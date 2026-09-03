import { MigrationInterface, QueryRunner } from 'typeorm';

export class DeletedAccounts1778730000000 implements MigrationInterface {
  name = 'DeletedAccounts1778730000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "deleted_accounts" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "account_type" varchar(16) NOT NULL,
        "name" varchar(255) NOT NULL,
        "email" varchar(255) NOT NULL,
        "phone" varchar(64),
        "country" varchar(2),
        "speciality_name" varchar(255),
        "deleted_by" varchar(16) NOT NULL DEFAULT 'self',
        "deleted_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_deleted_accounts" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_deleted_accounts_type"
      ON "deleted_accounts" ("account_type", "deleted_at" DESC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "deleted_accounts"`);
  }
}
