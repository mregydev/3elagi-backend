import { MigrationInterface, QueryRunner } from 'typeorm';

export class DefaultMessagePointsTen1778200000000 implements MigrationInterface {
  name = 'DefaultMessagePointsTen1778200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      ALTER COLUMN "message_points" SET DEFAULT 10
    `);

    await queryRunner.query(`
      UPDATE "users"
      SET "message_points" = 10
      WHERE "role" IN ('patient', 'doctor')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      ALTER COLUMN "message_points" SET DEFAULT 20
    `);
  }
}
