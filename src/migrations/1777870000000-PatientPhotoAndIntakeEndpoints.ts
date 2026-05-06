import { MigrationInterface, QueryRunner } from 'typeorm';

export class PatientPhotoAndIntakeEndpoints1777870000000
  implements MigrationInterface
{
  name = 'PatientPhotoAndIntakeEndpoints1777870000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "patient_profiles" ADD COLUMN IF NOT EXISTS "photo_url" text`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "patient_profiles" DROP COLUMN IF EXISTS "photo_url"`,
    );
  }
}
