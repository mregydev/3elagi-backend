import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Country the patient consulted from (resolved from their IP) plus the USD
 * value of one credit at that moment, so the consultation keeps what it was
 * worth even after an admin edits `point_pricing`.
 */
export class ConsultationPatientCountry1778550000000
  implements MigrationInterface
{
  name = 'ConsultationPatientCountry1778550000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "consultations"
      ADD COLUMN IF NOT EXISTS "patient_country" varchar(2)
    `);
    await queryRunner.query(`
      ALTER TABLE "consultations"
      ADD COLUMN IF NOT EXISTS "point_price_usd" numeric(12,2)
    `);

    // Existing rows predate IP capture — fall back to the patient's profile.
    await queryRunner.query(`
      UPDATE "consultations" c
      SET "patient_country" = upper(left(p."country", 2))
      FROM "patient_profiles" p
      WHERE p."user_id" = c."patient_id"
        AND c."patient_country" IS NULL
        AND p."country" IS NOT NULL
    `);
    await queryRunner.query(`
      UPDATE "consultations" c
      SET "point_price_usd" = pp."price_per_point"
      FROM "point_pricing" pp
      WHERE pp."market" = CASE
          WHEN c."patient_country" IN ('EG', 'JO') THEN c."patient_country"
          ELSE 'INTL'
        END
        AND c."point_price_usd" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "consultations" DROP COLUMN IF EXISTS "point_price_usd"
    `);
    await queryRunner.query(`
      ALTER TABLE "consultations" DROP COLUMN IF EXISTS "patient_country"
    `);
  }
}
