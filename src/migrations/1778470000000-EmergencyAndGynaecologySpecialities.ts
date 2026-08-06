import { MigrationInterface, QueryRunner } from 'typeorm';
import { SPECIALITY_IMAGES } from '../constants/speciality-images';

function esc(value: string): string {
  return value.replace(/'/g, "''");
}

const NEW_SPECIALITIES: Array<{ name_en: string; name_ar: string }> = [
  { name_en: 'Emergency', name_ar: 'طوارئ' },
  { name_en: 'Gynaecology', name_ar: 'نساء وتوليد' },
];

export class EmergencyAndGynaecologySpecialities1778470000000
  implements MigrationInterface
{
  name = 'EmergencyAndGynaecologySpecialities1778470000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const spec of NEW_SPECIALITIES) {
      const imageUrl = SPECIALITY_IMAGES[spec.name_en];
      if (!imageUrl) {
        throw new Error(`Missing speciality image for ${spec.name_en}`);
      }

      await queryRunner.query(`
        INSERT INTO "doctor_specialities" ("name_en", "name_ar", "image_url", "created_at", "updated_at")
        SELECT '${esc(spec.name_en)}', '${esc(spec.name_ar)}', '${esc(imageUrl)}', NOW(), NOW()
        WHERE NOT EXISTS (
          SELECT 1 FROM "doctor_specialities" WHERE "name_en" = '${esc(spec.name_en)}'
        )
      `);

      // Keep image_url in sync if the row already existed.
      await queryRunner.query(`
        UPDATE "doctor_specialities"
        SET "image_url" = '${esc(imageUrl)}',
            "name_ar" = '${esc(spec.name_ar)}',
            "updated_at" = NOW()
        WHERE "name_en" = '${esc(spec.name_en)}'
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const spec of NEW_SPECIALITIES) {
      await queryRunner.query(
        `DELETE FROM "doctor_speciality_links"
         WHERE "speciality_id" IN (
           SELECT "id" FROM "doctor_specialities" WHERE "name_en" = '${esc(spec.name_en)}'
         )`,
      );
      await queryRunner.query(
        `UPDATE "doctors" SET "speciality_id" = NULL
         WHERE "speciality_id" IN (
           SELECT "id" FROM "doctor_specialities" WHERE "name_en" = '${esc(spec.name_en)}'
         )`,
      );
      await queryRunner.query(
        `DELETE FROM "doctor_specialities" WHERE "name_en" = '${esc(spec.name_en)}'`,
      );
    }
  }
}
