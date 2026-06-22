import { MigrationInterface, QueryRunner } from 'typeorm';

export class MedicalDocumentsTitle1777970000000 implements MigrationInterface {
  name = 'MedicalDocumentsTitle1777970000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "medical_documents" ADD COLUMN IF NOT EXISTS "title" character varying`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "medical_documents" DROP COLUMN IF EXISTS "title"`,
    );
  }
}
