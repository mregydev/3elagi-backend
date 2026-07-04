import { MigrationInterface, QueryRunner } from 'typeorm';

export class IntakeExamInstances1778260000000 implements MigrationInterface {
  name = 'IntakeExamInstances1778260000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "intake_exam_assignments" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "patient_user_id" uuid NOT NULL,
        "doctor_id" uuid NOT NULL,
        "intake_test_id" uuid NOT NULL,
        "exam_name" character varying NOT NULL,
        "exam_description" text,
        "recurrence_type" character varying(16) NOT NULL DEFAULT 'none',
        "recurrence_interval" integer NOT NULL DEFAULT 1,
        "first_deadline_at" TIMESTAMPTZ NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_intake_exam_assignments" PRIMARY KEY ("id"),
        CONSTRAINT "FK_intake_exam_assignments_doctor"
          FOREIGN KEY ("doctor_id") REFERENCES "doctors"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_intake_exam_assignments_intake_test"
          FOREIGN KEY ("intake_test_id") REFERENCES "intake_tests"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "intake_exam_instances" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "assignment_id" uuid NOT NULL,
        "patient_user_id" uuid NOT NULL,
        "doctor_id" uuid NOT NULL,
        "intake_test_id" uuid NOT NULL,
        "exam_name" character varying NOT NULL,
        "instance_number" integer NOT NULL DEFAULT 1,
        "deadline_at" TIMESTAMPTZ NOT NULL,
        "questions" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "answers" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "status" character varying(16) NOT NULL DEFAULT 'pending',
        "reminder_sent_at" TIMESTAMPTZ,
        "completed_at" TIMESTAMPTZ,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_intake_exam_instances" PRIMARY KEY ("id"),
        CONSTRAINT "FK_intake_exam_instances_assignment"
          FOREIGN KEY ("assignment_id") REFERENCES "intake_exam_assignments"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_intake_exam_instances_doctor"
          FOREIGN KEY ("doctor_id") REFERENCES "doctors"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_intake_exam_instances_intake_test"
          FOREIGN KEY ("intake_test_id") REFERENCES "intake_tests"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_intake_exam_instances_patient"
      ON "intake_exam_instances" ("patient_user_id", "deadline_at" DESC)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_intake_exam_instances_reminder"
      ON "intake_exam_instances" ("deadline_at", "reminder_sent_at")
      WHERE "status" != 'completed'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "intake_exam_instances"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "intake_exam_assignments"`);
  }
}
