import { MigrationInterface, QueryRunner } from 'typeorm';

/** Chat / portal bookings created before booked_via_app was set consistently. */
export class BackfillBookedViaApp1778590000000 implements MigrationInterface {
  name = 'BackfillBookedViaApp1778590000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "appointments"
      SET "booked_via_app" = true
      WHERE "patient_user_id" IS NOT NULL
        AND "booked_via_app" = false
    `);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Non-destructive backfill — no down migration.
  }
}
