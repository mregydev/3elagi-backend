import { MigrationInterface, QueryRunner } from 'typeorm';

export class PrescriptionTemplates1777810000000 implements MigrationInterface {
  name = 'PrescriptionTemplates1777810000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "prescription_templates" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "doctor_id" uuid NOT NULL,
        "name" character varying NOT NULL,
        "title" character varying,
        "symptoms" text,
        "items" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_prescription_templates" PRIMARY KEY ("id"),
        CONSTRAINT "FK_prescription_templates_doctor" FOREIGN KEY ("doctor_id") REFERENCES "doctors"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_prescription_templates_doctor" ON "prescription_templates" ("doctor_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_prescription_templates_doctor"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "prescription_templates"`);
  }
}
