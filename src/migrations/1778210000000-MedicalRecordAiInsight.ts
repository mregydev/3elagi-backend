import { MigrationInterface, QueryRunner } from 'typeorm';

export class MedicalRecordAiInsight1778210000000 implements MigrationInterface {
  name = 'MedicalRecordAiInsight1778210000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "medical_documents"
      ADD COLUMN IF NOT EXISTS "ai_insight" jsonb
    `);
    await queryRunner.query(`
      ALTER TABLE "diagnoses"
      ADD COLUMN IF NOT EXISTS "ai_insight" jsonb
    `);
    await queryRunner.query(`
      ALTER TABLE "prescriptions"
      ADD COLUMN IF NOT EXISTS "ai_insight" jsonb
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "prescriptions" DROP COLUMN IF EXISTS "ai_insight"
    `);
    await queryRunner.query(`
      ALTER TABLE "diagnoses" DROP COLUMN IF EXISTS "ai_insight"
    `);
    await queryRunner.query(`
      ALTER TABLE "medical_documents" DROP COLUMN IF EXISTS "ai_insight"
    `);
  }
}
