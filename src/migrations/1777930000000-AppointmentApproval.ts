import { MigrationInterface, QueryRunner } from 'typeorm';

export class AppointmentApproval1777930000000 implements MigrationInterface {
  name = 'AppointmentApproval1777930000000';
  // Postgres requires ALTER TYPE ... ADD VALUE outside a transaction block,
  // so this migration must NOT be wrapped in a transaction.
  transaction = false as const;

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Each ADD VALUE IF NOT EXISTS is idempotent and safe to re-run.
    await queryRunner.query(
      `ALTER TYPE "appointments_status_enum" ADD VALUE IF NOT EXISTS 'pending'`,
    );
    await queryRunner.query(
      `ALTER TYPE "appointments_status_enum" ADD VALUE IF NOT EXISTS 'confirmed'`,
    );
    await queryRunner.query(
      `ALTER TYPE "appointments_status_enum" ADD VALUE IF NOT EXISTS 'rejected'`,
    );
  }

  public async down(): Promise<void> {
    // Postgres does not support removing enum values without recreating the
    // type. Leaving as a no-op; the new values are harmless if present.
  }
}
