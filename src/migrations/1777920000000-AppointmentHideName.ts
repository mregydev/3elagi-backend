import { MigrationInterface, QueryRunner } from 'typeorm';

export class AppointmentHideName1777920000000 implements MigrationInterface {
  name = 'AppointmentHideName1777920000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "hide_name" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "appointments" DROP COLUMN IF EXISTS "hide_name"`,
    );
  }
}
