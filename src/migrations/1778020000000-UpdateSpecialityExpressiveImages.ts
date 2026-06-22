import { MigrationInterface, QueryRunner } from 'typeorm';
import { SPECIALITY_IMAGES } from '../constants/speciality-images';

function esc(value: string): string {
  return value.replace(/'/g, "''");
}

export class UpdateSpecialityExpressiveImages1778020000000
  implements MigrationInterface
{
  name = 'UpdateSpecialityExpressiveImages1778020000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const [nameEn, imageUrl] of Object.entries(SPECIALITY_IMAGES)) {
      await queryRunner.query(
        `UPDATE "doctor_specialities" SET "image_url" = '${esc(imageUrl)}' WHERE "name_en" = '${esc(nameEn)}'`,
      );
    }
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Keep expressive images on rollback.
  }
}
