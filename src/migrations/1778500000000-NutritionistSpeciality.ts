import { MigrationInterface, QueryRunner } from 'typeorm';
import { SPECIALITY_IMAGES } from '../constants/speciality-images';

function esc(value: string): string {
  return value.replace(/'/g, "''");
}

const SPEC = {
  name_en: 'Nutritionist',
  name_ar: 'تغذية',
};

export class NutritionistSpeciality1778500000000 implements MigrationInterface {
  name = 'NutritionistSpeciality1778500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const imageUrl = SPECIALITY_IMAGES[SPEC.name_en];
    if (!imageUrl) {
      throw new Error(`Missing speciality image for ${SPEC.name_en}`);
    }

    await queryRunner.query(`
      INSERT INTO "doctor_specialities" ("name_en", "name_ar", "image_url", "created_at", "updated_at")
      SELECT '${esc(SPEC.name_en)}', '${esc(SPEC.name_ar)}', '${esc(imageUrl)}', NOW(), NOW()
      WHERE NOT EXISTS (
        SELECT 1 FROM "doctor_specialities" WHERE "name_en" = '${esc(SPEC.name_en)}'
      )
    `);

    await queryRunner.query(`
      UPDATE "doctor_specialities"
      SET "image_url" = '${esc(imageUrl)}',
          "name_ar" = '${esc(SPEC.name_ar)}',
          "updated_at" = NOW()
      WHERE "name_en" = '${esc(SPEC.name_en)}'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "doctor_speciality_links"
       WHERE "speciality_id" IN (
         SELECT "id" FROM "doctor_specialities" WHERE "name_en" = '${esc(SPEC.name_en)}'
       )`,
    );
    await queryRunner.query(
      `UPDATE "doctors" SET "speciality_id" = NULL
       WHERE "speciality_id" IN (
         SELECT "id" FROM "doctor_specialities" WHERE "name_en" = '${esc(SPEC.name_en)}'
       )`,
    );
    await queryRunner.query(
      `DELETE FROM "doctor_specialities" WHERE "name_en" = '${esc(SPEC.name_en)}'`,
    );
  }
}
