import { MigrationInterface, QueryRunner } from 'typeorm';
import { SPECIALITY_IMAGES } from '../constants/speciality-images';

function esc(value: string): string {
  return value.replace(/'/g, "''");
}

export class BundledSpecialityImages1778030000000
  implements MigrationInterface
{
  name = 'BundledSpecialityImages1778030000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const [nameEn, imagePath] of Object.entries(SPECIALITY_IMAGES)) {
      await queryRunner.query(
        `UPDATE "doctor_specialities" SET "image_url" = '${esc(imagePath)}' WHERE "name_en" = '${esc(nameEn)}'`,
      );
    }
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Keep bundled image paths on rollback.
  }
}
