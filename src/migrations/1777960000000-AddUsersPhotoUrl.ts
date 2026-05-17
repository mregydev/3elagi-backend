import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUsersPhotoUrl1777960000000 implements MigrationInterface {
  name = 'AddUsersPhotoUrl1777960000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "photo_url" text`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "photo_url"`,
    );
  }
}
