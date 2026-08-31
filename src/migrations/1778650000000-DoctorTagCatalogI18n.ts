import { MigrationInterface, QueryRunner } from 'typeorm';
import {
  DOCTOR_TAG_I18N,
  type DoctorTagI18nRow,
} from '../constants/doctor-tag-i18n';
import { normalizeDoctorTagKey } from '../constants/doctor-tag-seeds';

function esc(value: string): string {
  return value.replace(/'/g, "''");
}

export class DoctorTagCatalogI18n1778650000000 implements MigrationInterface {
  name = 'DoctorTagCatalogI18n1778650000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "doctor_tag_catalog"
      ADD COLUMN IF NOT EXISTS "label_ar" varchar(40),
      ADD COLUMN IF NOT EXISTS "label_de" varchar(40),
      ADD COLUMN IF NOT EXISTS "label_es" varchar(40)
    `);

    for (const [key, row] of Object.entries(DOCTOR_TAG_I18N) as Array<
      [string, DoctorTagI18nRow]
    >) {
      await queryRunner.query(`
        UPDATE "doctor_tag_catalog"
        SET
          "label_ar" = '${esc(row.ar)}',
          "label_de" = '${esc(row.de)}',
          "label_es" = '${esc(row.es)}'
        WHERE "label_normalized" = '${esc(key)}'
      `);
    }

    const catalogRows = (await queryRunner.query(
      `SELECT "label", "label_normalized" FROM "doctor_tag_catalog"`,
    )) as Array<{ label: string; label_normalized: string }>;

    for (const row of catalogRows) {
      const i18n = DOCTOR_TAG_I18N[row.label_normalized];
      if (i18n) continue;
      const fallbackKey = normalizeDoctorTagKey(row.label);
      const fallback = DOCTOR_TAG_I18N[fallbackKey];
      if (!fallback) continue;
      await queryRunner.query(`
        UPDATE "doctor_tag_catalog"
        SET
          "label_ar" = '${esc(fallback.ar)}',
          "label_de" = '${esc(fallback.de)}',
          "label_es" = '${esc(fallback.es)}'
        WHERE "label_normalized" = '${esc(row.label_normalized)}'
          AND "label_ar" IS NULL
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "doctor_tag_catalog"
      DROP COLUMN IF EXISTS "label_ar",
      DROP COLUMN IF EXISTS "label_de",
      DROP COLUMN IF EXISTS "label_es"
    `);
  }
}
