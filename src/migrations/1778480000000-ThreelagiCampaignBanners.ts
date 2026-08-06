import { MigrationInterface, QueryRunner } from 'typeorm';
import { ADVERTISEMENT_IMAGES } from '../constants/advertisement-images';

function esc(value: string): string {
  return value.replace(/'/g, "''");
}

const CAMPAIGN_ADS: Array<{
  title: string;
  description: string;
  sort_order: number;
}> = [
  {
    title: 'Care in One Tap',
    description: 'Chat with trusted doctors on 3elagi anytime, anywhere.',
    sort_order: 1,
  },
  {
    title: 'Trusted Doctors Near You',
    description: 'Browse specialists across Egypt and Jordan in one place.',
    sort_order: 2,
  },
  {
    title: 'Your AI Health Companion',
    description: 'Ask 3elagi for guided health answers, day or night.',
    sort_order: 3,
  },
  {
    title: 'Book. Chat. Heal.',
    description: 'Start a consultation and get the care you need today.',
    sort_order: 4,
  },
];

const LEGACY_TITLES = [
  'Partner Clinic Checkups',
  'Medicine Home Delivery',
  'Free Consultation Week',
  'Annual Health Screening',
];

export class ThreelagiCampaignBanners1778480000000
  implements MigrationInterface
{
  name = 'ThreelagiCampaignBanners1778480000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const title of LEGACY_TITLES) {
      await queryRunner.query(
        `UPDATE "advertisements"
         SET "is_active" = false, "updated_at" = NOW()
         WHERE "title" = '${esc(title)}'`,
      );
    }

    for (const ad of CAMPAIGN_ADS) {
      const banner = ADVERTISEMENT_IMAGES[ad.title];
      if (!banner) {
        throw new Error(`Missing campaign banner image for ${ad.title}`);
      }

      await queryRunner.query(`
        INSERT INTO "advertisements" (
          "title", "description", "banner_image_url", "clinic_id",
          "sort_order", "is_active", "created_at", "updated_at"
        )
        SELECT
          '${esc(ad.title)}',
          '${esc(ad.description)}',
          '${esc(banner)}',
          NULL,
          ${ad.sort_order},
          true,
          NOW(),
          NOW()
        WHERE NOT EXISTS (
          SELECT 1 FROM "advertisements" WHERE "title" = '${esc(ad.title)}'
        )
      `);

      await queryRunner.query(`
        UPDATE "advertisements"
        SET "description" = '${esc(ad.description)}',
            "banner_image_url" = '${esc(banner)}',
            "clinic_id" = NULL,
            "sort_order" = ${ad.sort_order},
            "is_active" = true,
            "updated_at" = NOW()
        WHERE "title" = '${esc(ad.title)}'
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const ad of CAMPAIGN_ADS) {
      await queryRunner.query(
        `DELETE FROM "advertisements" WHERE "title" = '${esc(ad.title)}'`,
      );
    }
    for (const title of LEGACY_TITLES) {
      await queryRunner.query(
        `UPDATE "advertisements"
         SET "is_active" = true, "updated_at" = NOW()
         WHERE "title" = '${esc(title)}'`,
      );
    }
  }
}
