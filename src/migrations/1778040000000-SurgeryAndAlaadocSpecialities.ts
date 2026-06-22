import { MigrationInterface, QueryRunner } from 'typeorm';
import { SPECIALITY_IMAGES } from '../constants/speciality-images';

function esc(value: string): string {
  return value.replace(/'/g, "''");
}

export class SurgeryAndAlaadocSpecialities1778040000000
  implements MigrationInterface
{
  name = 'SurgeryAndAlaadocSpecialities1778040000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "doctor_speciality_links" (
        "doctor_id" uuid NOT NULL REFERENCES "doctors"("id") ON DELETE CASCADE,
        "speciality_id" uuid NOT NULL REFERENCES "doctor_specialities"("id") ON DELETE CASCADE,
        PRIMARY KEY ("doctor_id", "speciality_id")
      )
    `);

    const existingSurgery = (await queryRunner.query(
      `SELECT "id" FROM "doctor_specialities" WHERE "name_en" = 'Surgery' LIMIT 1`,
    )) as { id: string }[];

    let surgeryId = existingSurgery[0]?.id;
    if (!surgeryId) {
      const surgeryImage =
        SPECIALITY_IMAGES.Surgery ?? SPECIALITY_IMAGES.Orthopedics;
      const inserted = (await queryRunner.query(`
        INSERT INTO "doctor_specialities" ("name_en", "name_ar", "image_url", "created_at", "updated_at")
        VALUES ('Surgery', 'جراحة', '${esc(surgeryImage)}', NOW(), NOW())
        RETURNING "id"
      `)) as { id: string }[];
      surgeryId = inserted[0].id;
    }

    const generalMedicine = (await queryRunner.query(
      `SELECT "id" FROM "doctor_specialities" WHERE "name_en" = 'General Medicine' LIMIT 1`,
    )) as { id: string }[];

    const generalMedicineId = generalMedicine[0]?.id;
    if (!generalMedicineId || !surgeryId) return;

    const alaaRows = (await queryRunner.query(
      `SELECT d."id" AS doctor_id
       FROM "users" u
       INNER JOIN "doctors" d ON d."user_id" = u."id"
       WHERE LOWER(u."email") = 'alaadoc@gmail.com'
       LIMIT 1`,
    )) as { doctor_id: string }[];

    if (alaaRows.length === 0) return;

    const doctorId = alaaRows[0].doctor_id;

    await queryRunner.query(
      `UPDATE "doctors"
       SET "speciality_id" = '${generalMedicineId}',
           "approval_status" = 'approved',
           "professional_title" = COALESCE(NULLIF("professional_title", ''), 'General Medicine')
       WHERE "id" = '${doctorId}'`,
    );

    for (const specialityId of [generalMedicineId, surgeryId]) {
      await queryRunner.query(
        `INSERT INTO "doctor_speciality_links" ("doctor_id", "speciality_id")
         VALUES ('${doctorId}', '${specialityId}')
         ON CONFLICT DO NOTHING`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "doctor_speciality_links"`);
    await queryRunner.query(
      `DELETE FROM "doctor_specialities" WHERE "name_en" = 'Surgery'`,
    );
  }
}
