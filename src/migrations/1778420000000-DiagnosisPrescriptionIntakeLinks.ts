import { MigrationInterface, QueryRunner } from 'typeorm';

export class DiagnosisPrescriptionIntakeLinks1778420000000
  implements MigrationInterface
{
  name = 'DiagnosisPrescriptionIntakeLinks1778420000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "prescriptions"
      ADD COLUMN IF NOT EXISTS "diagnosis_id" uuid NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_prescriptions_diagnosis_id"
      ON "prescriptions" ("diagnosis_id")
    `);

    await queryRunner.query(`
      ALTER TABLE "intake_exam_assignments"
      ADD COLUMN IF NOT EXISTS "diagnosis_id" uuid NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_intake_exam_assignments_diagnosis_id"
      ON "intake_exam_assignments" ("diagnosis_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_intake_exam_assignments_diagnosis_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "intake_exam_assignments"
      DROP COLUMN IF EXISTS "diagnosis_id"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_prescriptions_diagnosis_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "prescriptions"
      DROP COLUMN IF EXISTS "diagnosis_id"
    `);
  }
}
