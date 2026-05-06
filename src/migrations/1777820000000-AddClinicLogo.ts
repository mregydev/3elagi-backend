import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddClinicLogo1777820000000 implements MigrationInterface {
  name = 'AddClinicLogo1777820000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "clinics" ADD COLUMN IF NOT EXISTS "logo_url" character varying`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "clinics" DROP COLUMN IF EXISTS "logo_url"`);
  }
}
