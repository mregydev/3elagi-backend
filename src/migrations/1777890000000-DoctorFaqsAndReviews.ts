import { MigrationInterface, QueryRunner } from 'typeorm';

export class DoctorFaqsAndReviews1777890000000 implements MigrationInterface {
  name = 'DoctorFaqsAndReviews1777890000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "doctors" ADD COLUMN IF NOT EXISTS "faqs" jsonb NOT NULL DEFAULT '[]'::jsonb`,
    );
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "doctor_reviews" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "doctor_id" uuid NOT NULL,
        "patient_user_id" uuid NOT NULL,
        "patient_name" varchar(120) NOT NULL,
        "rating" integer NOT NULL,
        "comment" text,
        "created_at" timestamp NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "idx_doctor_reviews_unique_per_patient" ON "doctor_reviews" ("doctor_id", "patient_user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_doctor_reviews_doctor" ON "doctor_reviews" ("doctor_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "doctor_reviews"`);
    await queryRunner.query(`ALTER TABLE "doctors" DROP COLUMN IF EXISTS "faqs"`);
  }
}
