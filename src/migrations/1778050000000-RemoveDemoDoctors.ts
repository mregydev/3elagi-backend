import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveDemoDoctors1778050000000 implements MigrationInterface {
  name = 'RemoveDemoDoctors1778050000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      WITH demo_users AS (
        SELECT "id" FROM "users" WHERE "email" LIKE 'demo.%@3elagi.local'
      ),
      demo_doctors AS (
        SELECT d."id"
        FROM "doctors" d
        INNER JOIN demo_users u ON d."user_id" = u."id"
      ),
      demo_clinics AS (
        SELECT c."id"
        FROM "clinics" c
        INNER JOIN demo_users u ON c."owner_id" = u."id"
      )
      DELETE FROM "doctor_speciality_links"
      WHERE "doctor_id" IN (SELECT "id" FROM demo_doctors)
    `);

    await queryRunner.query(`
      WITH demo_users AS (
        SELECT "id" FROM "users" WHERE "email" LIKE 'demo.%@3elagi.local'
      ),
      demo_doctors AS (
        SELECT d."id"
        FROM "doctors" d
        INNER JOIN demo_users u ON d."user_id" = u."id"
      )
      DELETE FROM "doctor_reviews"
      WHERE "doctor_id" IN (SELECT "id" FROM demo_doctors)
    `);

    await queryRunner.query(`
      WITH demo_users AS (
        SELECT "id" FROM "users" WHERE "email" LIKE 'demo.%@3elagi.local'
      ),
      demo_doctors AS (
        SELECT d."id"
        FROM "doctors" d
        INNER JOIN demo_users u ON d."user_id" = u."id"
      )
      DELETE FROM "doctor_schedule_overrides"
      WHERE "doctor_id" IN (SELECT "id" FROM demo_doctors)
    `);

    await queryRunner.query(`
      WITH demo_users AS (
        SELECT "id" FROM "users" WHERE "email" LIKE 'demo.%@3elagi.local'
      ),
      demo_doctors AS (
        SELECT d."id"
        FROM "doctors" d
        INNER JOIN demo_users u ON d."user_id" = u."id"
      )
      DELETE FROM "doctor_schedules"
      WHERE "doctor_id" IN (SELECT "id" FROM demo_doctors)
    `);

    await queryRunner.query(`
      WITH demo_users AS (
        SELECT "id" FROM "users" WHERE "email" LIKE 'demo.%@3elagi.local'
      ),
      demo_doctors AS (
        SELECT d."id"
        FROM "doctors" d
        INNER JOIN demo_users u ON d."user_id" = u."id"
      )
      DELETE FROM "clinic_join_requests"
      WHERE "doctor_id" IN (SELECT "id" FROM demo_doctors)
    `);

    await queryRunner.query(`
      WITH demo_users AS (
        SELECT "id" FROM "users" WHERE "email" LIKE 'demo.%@3elagi.local'
      ),
      demo_doctors AS (
        SELECT d."id"
        FROM "doctors" d
        INNER JOIN demo_users u ON d."user_id" = u."id"
      )
      DELETE FROM "prescription_templates"
      WHERE "doctor_id" IN (SELECT "id" FROM demo_doctors)
    `);

    await queryRunner.query(`
      WITH demo_users AS (
        SELECT "id" FROM "users" WHERE "email" LIKE 'demo.%@3elagi.local'
      ),
      demo_doctors AS (
        SELECT d."id"
        FROM "doctors" d
        INNER JOIN demo_users u ON d."user_id" = u."id"
      )
      DELETE FROM "prescriptions"
      WHERE "doctor_id" IN (SELECT "id" FROM demo_doctors)
    `);

    await queryRunner.query(`
      WITH demo_users AS (
        SELECT "id" FROM "users" WHERE "email" LIKE 'demo.%@3elagi.local'
      ),
      demo_doctors AS (
        SELECT d."id"
        FROM "doctors" d
        INNER JOIN demo_users u ON d."user_id" = u."id"
      )
      DELETE FROM "intake_tests"
      WHERE "doctor_id" IN (SELECT "id" FROM demo_doctors)
    `);

    await queryRunner.query(`
      WITH demo_users AS (
        SELECT "id" FROM "users" WHERE "email" LIKE 'demo.%@3elagi.local'
      ),
      demo_doctors AS (
        SELECT d."id"
        FROM "doctors" d
        INNER JOIN demo_users u ON d."user_id" = u."id"
      )
      UPDATE "appointments"
      SET "doctor_id" = NULL
      WHERE "doctor_id" IN (SELECT "id" FROM demo_doctors)
    `);

    await queryRunner.query(`
      WITH demo_users AS (
        SELECT "id" FROM "users" WHERE "email" LIKE 'demo.%@3elagi.local'
      ),
      demo_doctors AS (
        SELECT d."id"
        FROM "doctors" d
        INNER JOIN demo_users u ON d."user_id" = u."id"
      )
      UPDATE "diagnoses"
      SET "doctor_id" = NULL
      WHERE "doctor_id" IN (SELECT "id" FROM demo_doctors)
    `);

    await queryRunner.query(`
      WITH demo_users AS (
        SELECT "id" FROM "users" WHERE "email" LIKE 'demo.%@3elagi.local'
      ),
      demo_doctors AS (
        SELECT d."id"
        FROM "doctors" d
        INNER JOIN demo_users u ON d."user_id" = u."id"
      )
      UPDATE "symptoms"
      SET "doctor_id" = NULL
      WHERE "doctor_id" IN (SELECT "id" FROM demo_doctors)
    `);

    await queryRunner.query(`
      WITH demo_users AS (
        SELECT "id" FROM "users" WHERE "email" LIKE 'demo.%@3elagi.local'
      )
      DELETE FROM "doctors"
      WHERE "user_id" IN (SELECT "id" FROM demo_users)
    `);

    await queryRunner.query(`
      WITH demo_users AS (
        SELECT "id" FROM "users" WHERE "email" LIKE 'demo.%@3elagi.local'
      )
      DELETE FROM "clinics"
      WHERE "owner_id" IN (SELECT "id" FROM demo_users)
    `);

    await queryRunner.query(`
      DELETE FROM "users"
      WHERE "email" LIKE 'demo.%@3elagi.local'
    `);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Demo seed data is not restored on rollback.
  }
}
