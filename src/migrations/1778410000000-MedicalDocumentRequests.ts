import { MigrationInterface, QueryRunner } from 'typeorm';

export class MedicalDocumentRequests1778410000000 implements MigrationInterface {
  name = 'MedicalDocumentRequests1778410000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "medical_document_requests" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "doctor_id" uuid NOT NULL,
        "patient_user_id" uuid NOT NULL,
        "type" character varying(16) NOT NULL,
        "title" character varying NOT NULL,
        "description" text,
        "status" character varying(16) NOT NULL DEFAULT 'pending',
        "fulfilled_document_id" uuid,
        "pdf_url" character varying,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_medical_document_requests" PRIMARY KEY ("id"),
        CONSTRAINT "FK_medical_document_requests_doctor" FOREIGN KEY ("doctor_id") REFERENCES "doctors"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_medical_document_requests_patient" FOREIGN KEY ("patient_user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_medical_document_requests_fulfilled_doc" FOREIGN KEY ("fulfilled_document_id") REFERENCES "medical_documents"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_medical_document_requests_doctor" ON "medical_document_requests" ("doctor_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_medical_document_requests_patient" ON "medical_document_requests" ("patient_user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_medical_document_requests_status" ON "medical_document_requests" ("status")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_medical_document_requests_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_medical_document_requests_patient"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_medical_document_requests_doctor"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "medical_document_requests"`);
  }
}
