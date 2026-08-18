import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Reschedules and post-approval cancellations wait for the other side's
 * answer; the proposal lives here until then.
 */
export class PendingChanges1778580000000 implements MigrationInterface {
  name = 'PendingChanges1778580000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const table of ['appointments', 'consultations']) {
      await queryRunner.query(`
        ALTER TABLE "${table}"
        ADD COLUMN IF NOT EXISTS "pending_change" jsonb
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of ['appointments', 'consultations']) {
      await queryRunner.query(`
        ALTER TABLE "${table}" DROP COLUMN IF EXISTS "pending_change"
      `);
    }
  }
}
