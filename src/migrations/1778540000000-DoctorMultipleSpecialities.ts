import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Doctors may practise several specialities. The link table already existed for
 * the browse query; this backfills it from the single `speciality_id` so an
 * existing doctor's speciality is part of their list, not a separate thing.
 */
export class DoctorMultipleSpecialities1778540000000
  implements MigrationInterface
{
  name = 'DoctorMultipleSpecialities1778540000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "doctor_speciality_links" (
        "doctor_id" uuid NOT NULL REFERENCES "doctors"("id") ON DELETE CASCADE,
        "speciality_id" uuid NOT NULL REFERENCES "doctor_specialities"("id") ON DELETE CASCADE,
        PRIMARY KEY ("doctor_id", "speciality_id")
      )
    `);

    await queryRunner.query(`
      INSERT INTO "doctor_speciality_links" ("doctor_id", "speciality_id")
      SELECT "id", "speciality_id" FROM "doctors" WHERE "speciality_id" IS NOT NULL
      ON CONFLICT DO NOTHING
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_doctor_speciality_links_speciality"
      ON "doctor_speciality_links" ("speciality_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Links are the only copy of the extra specialities — dropping the table
    // would lose them, so only the index this migration added goes away.
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_doctor_speciality_links_speciality"`,
    );
  }
}
