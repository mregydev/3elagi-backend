import { MigrationInterface, QueryRunner } from 'typeorm';

export class DoctorRegistrationRequestCountry1778620000000
  implements MigrationInterface
{
  name = 'DoctorRegistrationRequestCountry1778620000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "doctor_registration_requests"
      ADD COLUMN IF NOT EXISTS "country" varchar(2) NOT NULL DEFAULT 'EG'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "doctor_registration_requests"
      DROP COLUMN IF EXISTS "country"
    `);
  }
}
