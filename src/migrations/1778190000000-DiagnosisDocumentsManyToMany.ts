import { MigrationInterface, QueryRunner } from 'typeorm';

export class DiagnosisDocumentsManyToMany1778190000000 implements MigrationInterface {
  name = 'DiagnosisDocumentsManyToMany1778190000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "diagnosis_documents" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "diagnosis_id" uuid NOT NULL,
        "medical_document_id" uuid NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_diagnosis_documents" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_diagnosis_documents_pair" UNIQUE ("diagnosis_id", "medical_document_id"),
        CONSTRAINT "FK_diagnosis_documents_diagnosis" FOREIGN KEY ("diagnosis_id") REFERENCES "diagnoses"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_diagnosis_documents_document" FOREIGN KEY ("medical_document_id") REFERENCES "medical_documents"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_diagnosis_documents_diagnosis" ON "diagnosis_documents" ("diagnosis_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_diagnosis_documents_document" ON "diagnosis_documents" ("medical_document_id")`,
    );

    await queryRunner.query(`
      INSERT INTO "diagnosis_documents" ("diagnosis_id", "medical_document_id")
      SELECT "diagnosis_id", "id"
      FROM "medical_documents"
      WHERE "diagnosis_id" IS NOT NULL
      ON CONFLICT ("diagnosis_id", "medical_document_id") DO NOTHING
    `);

    await queryRunner.query(`
      UPDATE "medical_documents" SET "diagnosis_id" = NULL WHERE "diagnosis_id" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "medical_documents" md
      SET "diagnosis_id" = dd."diagnosis_id"
      FROM (
        SELECT DISTINCT ON ("medical_document_id") "medical_document_id", "diagnosis_id"
        FROM "diagnosis_documents"
        ORDER BY "medical_document_id", "created_at" ASC
      ) dd
      WHERE md."id" = dd."medical_document_id"
    `);

    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_diagnosis_documents_document"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_diagnosis_documents_diagnosis"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "diagnosis_documents"`);
  }
}
