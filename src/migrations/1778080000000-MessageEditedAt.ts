import { MigrationInterface, QueryRunner } from 'typeorm';

export class MessageEditedAt1778080000000 implements MigrationInterface {
  name = 'MessageEditedAt1778080000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "messages"
      ADD COLUMN IF NOT EXISTS "edited_at" TIMESTAMPTZ NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "messages" DROP COLUMN IF EXISTS "edited_at"
    `);
  }
}
