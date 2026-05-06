import { MigrationInterface, QueryRunner } from 'typeorm';

export class DoctorTags1777900000000 implements MigrationInterface {
  name = 'DoctorTags1777900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "doctors" ADD COLUMN IF NOT EXISTS "tags" jsonb NOT NULL DEFAULT '[]'::jsonb`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "doctors" DROP COLUMN IF EXISTS "tags"`);
  }
}
