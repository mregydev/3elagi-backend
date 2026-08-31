import { MigrationInterface, QueryRunner } from 'typeorm';
import {
  COMMON_DOCTOR_TAG_SEEDS,
  normalizeDoctorTagKey,
  normalizeDoctorTagLabel,
  SPECIALITY_DOCTOR_TAG_SEEDS,
} from '../constants/doctor-tag-seeds';

function esc(value: string): string {
  return value.replace(/'/g, "''");
}

export class DoctorTagCatalog1778640000000 implements MigrationInterface {
  name = 'DoctorTagCatalog1778640000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "doctor_tag_catalog" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "label" varchar(40) NOT NULL,
        "label_normalized" varchar(40) NOT NULL,
        "speciality_id" uuid,
        "is_seeded" boolean NOT NULL DEFAULT false,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_doctor_tag_catalog" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_doctor_tag_catalog_label_normalized" UNIQUE ("label_normalized"),
        CONSTRAINT "FK_doctor_tag_catalog_speciality"
          FOREIGN KEY ("speciality_id") REFERENCES "doctor_specialities"("id")
          ON DELETE SET NULL
      )
    `);

    for (const raw of COMMON_DOCTOR_TAG_SEEDS) {
      const label = normalizeDoctorTagLabel(raw);
      const key = normalizeDoctorTagKey(label);
      if (!key) continue;
      await queryRunner.query(`
        INSERT INTO "doctor_tag_catalog" ("label", "label_normalized", "speciality_id", "is_seeded")
        SELECT '${esc(label)}', '${esc(key)}', NULL, true
        WHERE NOT EXISTS (
          SELECT 1 FROM "doctor_tag_catalog" WHERE "label_normalized" = '${esc(key)}'
        )
      `);
    }

    for (const [nameEn, tags] of Object.entries(SPECIALITY_DOCTOR_TAG_SEEDS)) {
      const rows = (await queryRunner.query(
        `SELECT "id" FROM "doctor_specialities" WHERE "name_en" = $1 LIMIT 1`,
        [nameEn],
      )) as Array<{ id: string }>;
      const specialityId = rows[0]?.id;
      if (!specialityId) continue;

      for (const raw of tags) {
        const label = normalizeDoctorTagLabel(raw);
        const key = normalizeDoctorTagKey(label);
        if (!key) continue;
        await queryRunner.query(`
          INSERT INTO "doctor_tag_catalog" ("label", "label_normalized", "speciality_id", "is_seeded")
          SELECT '${esc(label)}', '${esc(key)}', '${specialityId}'::uuid, true
          WHERE NOT EXISTS (
            SELECT 1 FROM "doctor_tag_catalog" WHERE "label_normalized" = '${esc(key)}'
          )
        `);
      }
    }

    await queryRunner.query(`
      INSERT INTO "doctor_tag_catalog" ("label", "label_normalized", "speciality_id", "is_seeded")
      SELECT DISTINCT
        LEFT(TRIM(tag.value), 40) AS label,
        LOWER(LEFT(TRIM(tag.value), 40)) AS label_normalized,
        d."speciality_id",
        false
      FROM "doctors" d
      CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(d."tags", '[]'::jsonb)) AS tag(value)
      WHERE TRIM(tag.value) <> ''
      ON CONFLICT ("label_normalized") DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "doctor_tag_catalog"`);
  }
}
