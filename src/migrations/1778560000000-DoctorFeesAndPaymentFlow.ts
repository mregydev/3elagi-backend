import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Cash fees the doctor sets (home currency + USD, per consultation kind), the
 * link patients pay through, and the payment state a video appointment or text
 * consultation sits in until the doctor approves the patient's payment proof.
 */
export class DoctorFeesAndPaymentFlow1778560000000
  implements MigrationInterface
{
  name = 'DoctorFeesAndPaymentFlow1778560000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const column of [
      'text_price_local',
      'text_price_usd',
      'video_price_local',
      'video_price_usd',
    ]) {
      await queryRunner.query(`
        ALTER TABLE "doctors"
        ADD COLUMN IF NOT EXISTS "${column}" numeric(12,2)
      `);
    }
    await queryRunner.query(`
      ALTER TABLE "doctors" ADD COLUMN IF NOT EXISTS "payment_link" text
    `);

    for (const table of ['appointments', 'consultations']) {
      await queryRunner.query(`
        ALTER TABLE "${table}"
        ADD COLUMN IF NOT EXISTS "payment_status" varchar(24) NOT NULL DEFAULT 'none'
      `);
      await queryRunner.query(`
        ALTER TABLE "${table}"
        ADD COLUMN IF NOT EXISTS "payment_amount" numeric(12,2)
      `);
      await queryRunner.query(`
        ALTER TABLE "${table}"
        ADD COLUMN IF NOT EXISTS "payment_currency" varchar(3)
      `);
      await queryRunner.query(`
        ALTER TABLE "${table}"
        ADD COLUMN IF NOT EXISTS "payment_proof_url" text
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of ['appointments', 'consultations']) {
      for (const column of [
        'payment_proof_url',
        'payment_currency',
        'payment_amount',
        'payment_status',
      ]) {
        await queryRunner.query(`
          ALTER TABLE "${table}" DROP COLUMN IF EXISTS "${column}"
        `);
      }
    }
    for (const column of [
      'payment_link',
      'video_price_usd',
      'video_price_local',
      'text_price_usd',
      'text_price_local',
    ]) {
      await queryRunner.query(`
        ALTER TABLE "doctors" DROP COLUMN IF EXISTS "${column}"
      `);
    }
  }
}
