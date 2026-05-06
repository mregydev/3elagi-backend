import { MigrationInterface, QueryRunner } from 'typeorm';

export class ScheduleOverrides1777850000000 implements MigrationInterface {
  name = 'ScheduleOverrides1777850000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "doctor_schedule_overrides" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "doctor_id" uuid NOT NULL,
        "scope" varchar(8) NOT NULL,
        "start_date" date NOT NULL,
        "end_date" date NOT NULL,
        "is_closed" boolean NOT NULL DEFAULT false,
        "start_time" time,
        "end_time" time,
        "slot_minutes" integer,
        "note" varchar,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_doctor_schedule_overrides" PRIMARY KEY ("id"),
        CONSTRAINT "FK_doctor_schedule_overrides_doctor" FOREIGN KEY ("doctor_id")
          REFERENCES "doctors"("id") ON DELETE CASCADE,
        CONSTRAINT "CK_doctor_schedule_overrides_scope" CHECK ("scope" IN ('day','week','month')),
        CONSTRAINT "CK_doctor_schedule_overrides_dates" CHECK ("end_date" >= "start_date")
      );
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_doctor_schedule_overrides_doctor" ON "doctor_schedule_overrides"("doctor_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_doctor_schedule_overrides_dates" ON "doctor_schedule_overrides"("doctor_id","start_date","end_date")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_doctor_schedule_overrides_dates"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_doctor_schedule_overrides_doctor"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "doctor_schedule_overrides"`);
  }
}
