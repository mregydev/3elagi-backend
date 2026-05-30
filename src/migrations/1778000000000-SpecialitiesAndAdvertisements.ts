import { MigrationInterface, QueryRunner } from 'typeorm';
import { SPECIALITY_IMAGES } from '../constants/speciality-images';

function esc(value: string): string {
  return value.replace(/'/g, "''");
}

const SPECIALITIES = [
  {
    name_en: 'General Medicine',
    name_ar: 'طب عام',
    image_url: SPECIALITY_IMAGES['General Medicine'],
  },
  {
    name_en: 'Cardiology',
    name_ar: 'أمراض القلب',
    image_url: SPECIALITY_IMAGES.Cardiology,
  },
  {
    name_en: 'Dermatology',
    name_ar: 'جلدية',
    image_url: SPECIALITY_IMAGES.Dermatology,
  },
  {
    name_en: 'Pediatrics',
    name_ar: 'طب الأطفال',
    image_url: SPECIALITY_IMAGES.Pediatrics,
  },
  {
    name_en: 'Orthopedics',
    name_ar: 'عظام',
    image_url: SPECIALITY_IMAGES.Orthopedics,
  },
  {
    name_en: 'Neurology',
    name_ar: 'أعصاب',
    image_url: SPECIALITY_IMAGES.Neurology,
  },
  {
    name_en: 'Ophthalmology',
    name_ar: 'عيون',
    image_url: SPECIALITY_IMAGES.Ophthalmology,
  },
  {
    name_en: 'Dentistry',
    name_ar: 'أسنان',
    image_url: SPECIALITY_IMAGES.Dentistry,
  },
];

const ADVERTISEMENTS = [
  {
    title: 'Partner Clinic Checkups',
    description:
      'Book a comprehensive health checkup at our partner clinics with trusted specialists.',
    banner_image_url:
      'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=800&h=400&fit=crop',
    sort_order: 1,
  },
  {
    title: 'Medicine Home Delivery',
    description:
      'Order prescriptions and over-the-counter medicine with fast delivery to your door.',
    banner_image_url:
      'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=800&h=400&fit=crop',
    sort_order: 2,
  },
  {
    title: 'Free Consultation Week',
    description:
      'New patients get a free first consultation with selected doctors this month.',
    banner_image_url:
      'https://images.unsplash.com/photo-1579684385127-1ef15d508118?w=800&h=400&fit=crop',
    sort_order: 3,
  },
  {
    title: 'Annual Health Screening',
    description:
      'Complete lab panels and imaging packages at discounted rates across partner clinics.',
    banner_image_url:
      'https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=800&h=400&fit=crop',
    sort_order: 4,
  },
];

export class SpecialitiesAndAdvertisements1778000000000
  implements MigrationInterface
{
  name = 'SpecialitiesAndAdvertisements1778000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "doctor_specialities" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name_en" varchar NOT NULL,
        "name_ar" varchar NOT NULL,
        "image_url" text NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_doctor_specialities" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "advertisements" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "title" varchar NOT NULL,
        "description" text NOT NULL,
        "banner_image_url" text NOT NULL,
        "clinic_id" uuid,
        "sort_order" integer NOT NULL DEFAULT 0,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_advertisements" PRIMARY KEY ("id"),
        CONSTRAINT "FK_advertisements_clinic" FOREIGN KEY ("clinic_id")
          REFERENCES "clinics"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "doctors"
      ADD COLUMN IF NOT EXISTS "speciality_id" uuid
    `);
    await queryRunner.query(`
      ALTER TABLE "doctors"
      ADD CONSTRAINT "FK_doctors_speciality"
      FOREIGN KEY ("speciality_id") REFERENCES "doctor_specialities"("id")
      ON DELETE SET NULL
    `).catch(() => undefined);

    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "doctor_info_id" uuid
    `);
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD CONSTRAINT "FK_users_doctor_info"
      FOREIGN KEY ("doctor_info_id") REFERENCES "doctors"("id")
      ON DELETE SET NULL
    `).catch(() => undefined);

    for (const s of SPECIALITIES) {
      const nameEn = esc(s.name_en);
      const nameAr = esc(s.name_ar);
      const imageUrl = esc(s.image_url);
      await queryRunner.query(`
        INSERT INTO "doctor_specialities" ("name_en", "name_ar", "image_url")
        SELECT '${nameEn}', '${nameAr}', '${imageUrl}'
        WHERE NOT EXISTS (
          SELECT 1 FROM "doctor_specialities" WHERE "name_en" = '${nameEn}'
        )
      `);
    }

    const generalRow = await queryRunner.query(
      `SELECT "id" FROM "doctor_specialities" WHERE "name_en" = 'General Medicine' LIMIT 1`,
    );
    const generalId = generalRow?.[0]?.id as string | undefined;

    if (generalId) {
      await queryRunner.query(
        `UPDATE "doctors" SET "speciality_id" = $1::uuid WHERE "speciality_id" IS NULL`,
        [generalId],
      );
    }

    await queryRunner.query(`
      UPDATE "users" u
      SET "doctor_info_id" = d."id"
      FROM "doctors" d
      WHERE d."user_id" = u."id"
        AND u."role" = 'doctor'
        AND u."doctor_info_id" IS NULL
    `);

    const clinicRows = await queryRunner.query(
      `SELECT "id" FROM "clinics" WHERE "is_personal" = false ORDER BY "created_at" ASC LIMIT 2`,
    );
    const clinicIds = (clinicRows as { id: string }[]).map((r) => r.id);

    for (let i = 0; i < ADVERTISEMENTS.length; i++) {
      const ad = ADVERTISEMENTS[i];
      const clinicId = i < clinicIds.length ? clinicIds[i] : null;
      const title = esc(ad.title);
      const description = esc(ad.description);
      const banner = esc(ad.banner_image_url);
      const clinicSql = clinicId ? `'${esc(clinicId)}'::uuid` : 'NULL';
      await queryRunner.query(`
        INSERT INTO "advertisements" ("title", "description", "banner_image_url", "clinic_id", "sort_order", "is_active")
        SELECT '${title}', '${description}', '${banner}', ${clinicSql}, ${ad.sort_order}, true
        WHERE NOT EXISTS (
          SELECT 1 FROM "advertisements" WHERE "title" = '${title}'
        )
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "FK_users_doctor_info"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "doctor_info_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "doctors" DROP CONSTRAINT IF EXISTS "FK_doctors_speciality"`,
    );
    await queryRunner.query(
      `ALTER TABLE "doctors" DROP COLUMN IF EXISTS "speciality_id"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "advertisements"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "doctor_specialities"`);
  }
}
