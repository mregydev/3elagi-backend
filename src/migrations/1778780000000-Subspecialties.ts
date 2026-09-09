import { MigrationInterface, QueryRunner } from 'typeorm';
import {
  normalizeSubspecialtyKey,
  normalizeSubspecialtyName,
  SUBSPECIALTY_SEEDS,
} from '../constants/subspecialty-seeds';
import { doctorTagI18nFor } from '../constants/doctor-tag-i18n';

function esc(value: string): string {
  return value.replace(/'/g, "''");
}

export class Subspecialties1778780000000 implements MigrationInterface {
  name = 'Subspecialties1778780000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "subspecialties" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "name_en" varchar(40) NOT NULL,
        "name_normalized" varchar(40) NOT NULL,
        "name_ar" varchar(40),
        "name_de" varchar(40),
        "name_es" varchar(40),
        "speciality_id" uuid NOT NULL,
        "is_seeded" boolean NOT NULL DEFAULT false,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_subspecialties" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_subspecialties_name_normalized" UNIQUE ("name_normalized"),
        CONSTRAINT "FK_subspecialties_speciality"
          FOREIGN KEY ("speciality_id") REFERENCES "doctor_specialities"("id")
          ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_subspecialties_speciality_id"
      ON "subspecialties" ("speciality_id")
    `);

    for (const [nameEn, names] of Object.entries(SUBSPECIALTY_SEEDS)) {
      const rows = (await queryRunner.query(
        `SELECT "id" FROM "doctor_specialities" WHERE "name_en" = $1 LIMIT 1`,
        [nameEn],
      )) as Array<{ id: string }>;
      const specialityId = rows[0]?.id;
      if (!specialityId) continue;

      for (const raw of names) {
        const name = normalizeSubspecialtyName(raw);
        const key = normalizeSubspecialtyKey(name);
        if (!key) continue;
        const i18n = doctorTagI18nFor(name);
        await queryRunner.query(`
          INSERT INTO "subspecialties" (
            "name_en", "name_normalized", "name_ar", "name_de", "name_es",
            "speciality_id", "is_seeded"
          )
          SELECT
            '${esc(name)}',
            '${esc(key)}',
            ${i18n?.ar ? `'${esc(i18n.ar)}'` : 'NULL'},
            ${i18n?.de ? `'${esc(i18n.de)}'` : 'NULL'},
            ${i18n?.es ? `'${esc(i18n.es)}'` : 'NULL'},
            '${specialityId}'::uuid,
            true
          WHERE NOT EXISTS (
            SELECT 1 FROM "subspecialties" WHERE "name_normalized" = '${esc(key)}'
          )
        `);
      }
    }

    // Migrate existing specialty-specific catalog tags into subspecialties.
    await queryRunner.query(`
      INSERT INTO "subspecialties" (
        "name_en", "name_normalized", "name_ar", "name_de", "name_es",
        "speciality_id", "is_seeded"
      )
      SELECT
        c."label",
        c."label_normalized",
        c."label_ar",
        c."label_de",
        c."label_es",
        c."speciality_id",
        c."is_seeded"
      FROM "doctor_tag_catalog" c
      WHERE c."speciality_id" IS NOT NULL
      ON CONFLICT ("name_normalized") DO NOTHING
    `);

    // Remove specialty-specific rows from the common tag catalog.
    await queryRunner.query(`
      DELETE FROM "doctor_tag_catalog" WHERE "speciality_id" IS NOT NULL
    `);

    // Remove Home visits from catalog and doctor profiles.
    await queryRunner.query(`
      DELETE FROM "doctor_tag_catalog" WHERE "label_normalized" = 'home visits'
    `);
    await queryRunner.query(`
      UPDATE "doctors" d
      SET "tags" = COALESCE(
        (
          SELECT jsonb_agg(tag.value)
          FROM jsonb_array_elements_text(COALESCE(d."tags", '[]'::jsonb)) AS tag(value)
          WHERE LOWER(TRIM(tag.value)) <> 'home visits'
        ),
        '[]'::jsonb
      )
      WHERE EXISTS (
        SELECT 1
        FROM jsonb_array_elements_text(COALESCE(d."tags", '[]'::jsonb)) AS tag(value)
        WHERE LOWER(TRIM(tag.value)) = 'home visits'
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "subspecialties"`);
  }
}
