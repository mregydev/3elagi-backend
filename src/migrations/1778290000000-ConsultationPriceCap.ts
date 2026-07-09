import { MigrationInterface, QueryRunner } from 'typeorm';

export class ConsultationPriceCap1778290000000 implements MigrationInterface {
  name = 'ConsultationPriceCap1778290000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "doctors" ALTER COLUMN "consultation_price" SET DEFAULT 1`,
    );
    // Consultation price is now capped at 5 points.
    await queryRunner.query(
      `UPDATE "doctors" SET "consultation_price" = LEAST(GREATEST("consultation_price", 1), 5)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "doctors" ALTER COLUMN "consultation_price" SET DEFAULT 10`,
    );
  }
}
