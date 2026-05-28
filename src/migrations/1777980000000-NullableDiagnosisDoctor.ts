import { MigrationInterface, QueryRunner } from 'typeorm';

export class NullableDiagnosisDoctor1777980000000 implements MigrationInterface {
  name = 'NullableDiagnosisDoctor1777980000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "diagnoses"
      ALTER COLUMN "doctor_id" DROP NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "diagnoses"
      ALTER COLUMN "doctor_id" SET NOT NULL
    `);
  }
}
