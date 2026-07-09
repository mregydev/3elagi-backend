import { MigrationInterface, QueryRunner } from 'typeorm';

export class DoctorPriceEgpCredits1778320000000 implements MigrationInterface {
  name = 'DoctorPriceEgpCredits1778320000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "doctors" DROP CONSTRAINT IF EXISTS "CHK_doctors_message_price_range"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "doctors"
      SET "message_price" = LEAST(GREATEST("message_price", 1), 5)
    `);
    await queryRunner.query(`
      ALTER TABLE "doctors"
      ADD CONSTRAINT "CHK_doctors_message_price_range"
      CHECK ("message_price" >= 1 AND "message_price" <= 5)
    `);
  }
}
