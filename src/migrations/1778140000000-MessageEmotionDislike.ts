import { MigrationInterface, QueryRunner } from 'typeorm';

export class MessageEmotionDislike1778140000000 implements MigrationInterface {
  name = 'MessageEmotionDislike1778140000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "message_emotions" DROP CONSTRAINT IF EXISTS "CHK_message_emotions_type"`,
    );
    await queryRunner.query(`
      ALTER TABLE "message_emotions"
      ADD CONSTRAINT "CHK_message_emotions_type"
      CHECK ("emotion" IN ('love', 'like', 'laugh', 'thumbsup', 'dislike'))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "message_emotions" DROP CONSTRAINT IF EXISTS "CHK_message_emotions_type"`,
    );
    await queryRunner.query(`
      ALTER TABLE "message_emotions"
      ADD CONSTRAINT "CHK_message_emotions_type"
      CHECK ("emotion" IN ('love', 'like', 'laugh', 'thumbsup'))
    `);
  }
}
