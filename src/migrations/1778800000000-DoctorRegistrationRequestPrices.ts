import { MigrationInterface, QueryRunner } from 'typeorm';

export class DoctorRegistrationRequestPrices1778800000000
  implements MigrationInterface
{
  name = 'DoctorRegistrationRequestPrices1778800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "doctor_registration_requests"
      ADD COLUMN IF NOT EXISTS "price_local" numeric(10,2) NULL,
      ADD COLUMN IF NOT EXISTS "price_usd" numeric(10,2) NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "doctor_registration_requests"
      DROP COLUMN IF EXISTS "price_usd",
      DROP COLUMN IF EXISTS "price_local"
    `);
  }
}
