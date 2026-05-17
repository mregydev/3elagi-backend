import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPatientsPhotoUrl1777950000000 implements MigrationInterface {
  name = 'AddPatientsPhotoUrl1777950000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "photo_url" text`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "patients" DROP COLUMN IF EXISTS "photo_url"`,
    );
  }
}
