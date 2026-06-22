import { MigrationInterface, QueryRunner } from 'typeorm';

export class DoctorMessagePrice1778110000000 implements MigrationInterface {
  name = 'DoctorMessagePrice1778110000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "doctors"
      ADD COLUMN IF NOT EXISTS "message_price" integer NOT NULL DEFAULT 1
    `);
    await queryRunner.query(`
      UPDATE "doctors"
      SET "message_price" = 1
      WHERE "message_price" IS NULL OR "message_price" < 1 OR "message_price" > 5
    `);
    await queryRunner.query(`
      ALTER TABLE "doctors"
      ADD CONSTRAINT "CHK_doctors_message_price_range"
      CHECK ("message_price" >= 1 AND "message_price" <= 5)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "doctors" DROP CONSTRAINT IF EXISTS "CHK_doctors_message_price_range"`,
    );
    await queryRunner.query(`ALTER TABLE "doctors" DROP COLUMN IF EXISTS "message_price"`);
  }
}
