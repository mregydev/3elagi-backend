import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Doctors who completed registration (speciality assigned) were left as pending
 * and were hidden from speciality browse lists. Approve them so they appear.
 */
export class ApproveRegisteredDoctors1778150000000 implements MigrationInterface {
  name = 'ApproveRegisteredDoctors1778150000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "doctors"
      SET "approval_status" = 'approved'
      WHERE "approval_status" = 'pending'
        AND "speciality_id" IS NOT NULL
    `);

    await queryRunner.query(`
      UPDATE "clinics" c
      SET "approval_status" = 'approved'
      FROM "doctors" d
      WHERE c.id = d.default_clinic_id
        AND c.is_personal = true
        AND c.approval_status = 'pending'
        AND d.approval_status = 'approved'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Cannot reliably revert — leave approved doctors as-is.
    void queryRunner;
  }
}
