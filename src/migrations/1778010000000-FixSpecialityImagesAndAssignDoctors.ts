import { MigrationInterface, QueryRunner } from 'typeorm';
import { SPECIALITY_IMAGES } from '../constants/speciality-images';

function esc(value: string): string {
  return value.replace(/'/g, "''");
}

const DEMO_PASSWORD_HASH =
  '$2a$10$sYq3k93NGjT53YkP6oCyLerfsVmCpgAg8KlQbcm6IgChHy/bV5ps.';

export class FixSpecialityImagesAndAssignDoctors1778010000000
  implements MigrationInterface
{
  name = 'FixSpecialityImagesAndAssignDoctors1778010000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const [nameEn, imageUrl] of Object.entries(SPECIALITY_IMAGES)) {
      await queryRunner.query(
        `UPDATE "doctor_specialities" SET "image_url" = '${esc(imageUrl)}' WHERE "name_en" = '${esc(nameEn)}'`,
      );
    }

    const specialities = (await queryRunner.query(
      `SELECT "id", "name_en" FROM "doctor_specialities" ORDER BY "name_en" ASC`,
    )) as { id: string; name_en: string }[];

    const doctors = (await queryRunner.query(
      `SELECT "id", "user_id" FROM "doctors" ORDER BY "created_at" ASC`,
    )) as { id: string; user_id: string }[];

    for (let i = 0; i < doctors.length; i++) {
      const spec = specialities[i % specialities.length];
      await queryRunner.query(
        `UPDATE "doctors"
         SET "speciality_id" = '${spec.id}',
             "approval_status" = 'approved',
             "professional_title" = COALESCE("professional_title", '${esc(spec.name_en)}')
         WHERE "id" = '${doctors[i].id}'`,
      );
    }

    for (const spec of specialities) {
      const covered = (await queryRunner.query(
        `SELECT COUNT(*)::int AS count FROM "doctors"
         WHERE "speciality_id" = '${spec.id}' AND "approval_status" = 'approved'`,
      )) as { count: number }[];

      if ((covered[0]?.count ?? 0) > 0) continue;

      const slug = spec.name_en.toLowerCase().replace(/[^a-z0-9]+/g, '.');
      const email = `demo.${slug}@3elagi.local`;
      const doctorName = `Dr. ${spec.name_en}`;

      const existingUser = (await queryRunner.query(
        `SELECT "id" FROM "users" WHERE "email" = '${esc(email)}' LIMIT 1`,
      )) as { id: string }[];

      let userId: string;

      if (existingUser.length > 0) {
        userId = existingUser[0].id;
      } else {
        const userRows = (await queryRunner.query(`
          INSERT INTO "users" ("email", "password_hash", "role", "created_at", "updated_at")
          VALUES ('${esc(email)}', '${DEMO_PASSWORD_HASH}', 'doctor', NOW(), NOW())
          RETURNING "id"
        `)) as { id: string }[];
        userId = userRows[0].id;
      }

      const existingDoctor = (await queryRunner.query(
        `SELECT "id" FROM "doctors" WHERE "user_id" = '${userId}' LIMIT 1`,
      )) as { id: string }[];

      if (existingDoctor.length > 0) {
        await queryRunner.query(
          `UPDATE "doctors"
           SET "speciality_id" = '${spec.id}',
               "approval_status" = 'approved',
               "professional_title" = '${esc(spec.name_en)}'
           WHERE "id" = '${existingDoctor[0].id}'`,
        );
        await queryRunner.query(
          `UPDATE "users" SET "doctor_info_id" = '${existingDoctor[0].id}' WHERE "id" = '${userId}'`,
        );
        continue;
      }

      const clinicRows = (await queryRunner.query(`
        INSERT INTO "clinics" (
          "name", "phone", "location", "owner_id", "is_personal",
          "approval_status", "created_at", "updated_at"
        )
        VALUES (
          '${esc(`${doctorName} Clinic`)}', '0100000000', 'Cairo', '${userId}',
          true, 'approved', NOW(), NOW()
        )
        RETURNING "id"
      `)) as { id: string }[];
      const clinicId = clinicRows[0].id;

      const doctorRows = (await queryRunner.query(`
        INSERT INTO "doctors" (
          "user_id", "name", "phone", "email", "default_clinic_id",
          "speciality_id", "approval_status", "professional_title",
          "experience_years", "consultation_fee_egp", "faqs", "tags",
          "created_at", "updated_at"
        )
        VALUES (
          '${userId}', '${esc(doctorName)}', '0100000000', '${esc(email)}', '${clinicId}',
          '${spec.id}', 'approved', '${esc(spec.name_en)}',
          10, 300, '[]'::jsonb, '[]'::jsonb, NOW(), NOW()
        )
        RETURNING "id"
      `)) as { id: string }[];

      await queryRunner.query(
        `UPDATE "users" SET "doctor_info_id" = '${doctorRows[0].id}' WHERE "id" = '${userId}'`,
      );
    }
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Seed data is not reverted — images/doctor assignments are safe to keep.
  }
}
