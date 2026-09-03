import { MigrationInterface, QueryRunner } from 'typeorm';

export class DoctorRegistrationClinicLocation1778710000000
  implements MigrationInterface
{
  name = 'DoctorRegistrationClinicLocation1778710000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "doctor_registration_requests"
      ADD COLUMN IF NOT EXISTS "clinic_location" varchar(512)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "doctor_registration_requests"
      DROP COLUMN IF EXISTS "clinic_location"
    `);
  }
}
