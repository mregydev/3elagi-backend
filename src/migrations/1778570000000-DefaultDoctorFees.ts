import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Starting prices for doctors who have not set their own: Egypt 200 EGP at
 * home, Jordan 15 JOD at home, 50 USD abroad in both markets. Only fills the
 * columns that are still empty, so nobody's edited price is overwritten.
 */
export class DefaultDoctorFees1778570000000 implements MigrationInterface {
  name = 'DefaultDoctorFees1778570000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "doctors"
      SET
        "text_price_local" = COALESCE("text_price_local", CASE
          WHEN UPPER(COALESCE("country", 'EG')) = 'JO' THEN 15 ELSE 200 END),
        "video_price_local" = COALESCE("video_price_local", CASE
          WHEN UPPER(COALESCE("country", 'EG')) = 'JO' THEN 15 ELSE 200 END),
        "text_price_usd" = COALESCE("text_price_usd", 50),
        "video_price_usd" = COALESCE("video_price_usd", 50)
    `);
  }

  public async down(): Promise<void> {
    // Prices are the doctor's data now — a rollback must not delete them.
  }
}
