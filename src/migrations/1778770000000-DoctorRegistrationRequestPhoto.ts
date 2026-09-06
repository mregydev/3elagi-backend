import { MigrationInterface, QueryRunner } from 'typeorm';

export class DoctorRegistrationRequestPhoto1778770000000
  implements MigrationInterface
{
  name = 'DoctorRegistrationRequestPhoto1778770000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "doctor_registration_requests"
      ADD COLUMN IF NOT EXISTS "photo_url" varchar(1024) NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "doctor_registration_requests"
      DROP COLUMN IF EXISTS "photo_url"
    `);
  }
}
