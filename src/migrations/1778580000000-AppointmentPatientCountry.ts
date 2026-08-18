import { MigrationInterface, QueryRunner } from 'typeorm';

/** Country the patient booked from (resolved from their IP at booking time). */
export class AppointmentPatientCountry1778580000000
  implements MigrationInterface
{
  name = 'AppointmentPatientCountry1778580000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "appointments"
      ADD COLUMN IF NOT EXISTS "patient_country" varchar(2)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "appointments" DROP COLUMN IF EXISTS "patient_country"
    `);
  }
}
