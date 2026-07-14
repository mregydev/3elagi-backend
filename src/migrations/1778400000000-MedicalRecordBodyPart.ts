import { MigrationInterface, QueryRunner } from 'typeorm';

export class MedicalRecordBodyPart1778400000000 implements MigrationInterface {
  name = 'MedicalRecordBodyPart1778400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "diagnoses"
      ADD COLUMN IF NOT EXISTS "body_part" character varying(32) NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "medical_documents"
      ADD COLUMN IF NOT EXISTS "body_part" character varying(32) NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "prescriptions"
      ADD COLUMN IF NOT EXISTS "body_part" character varying(32) NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "prescriptions" DROP COLUMN IF EXISTS "body_part"
    `);
    await queryRunner.query(`
      ALTER TABLE "medical_documents" DROP COLUMN IF EXISTS "body_part"
    `);
    await queryRunner.query(`
      ALTER TABLE "diagnoses" DROP COLUMN IF EXISTS "body_part"
    `);
  }
}
