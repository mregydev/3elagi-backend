import { MigrationInterface, QueryRunner } from 'typeorm';

export class AppointmentAiInsight1778360000000 implements MigrationInterface {
  name = 'AppointmentAiInsight1778360000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "appointments"
      ADD COLUMN IF NOT EXISTS "ai_patient_insight" text NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "appointments"
      DROP COLUMN IF EXISTS "ai_patient_insight"
    `);
  }
}
