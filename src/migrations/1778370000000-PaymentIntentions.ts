import { MigrationInterface, QueryRunner } from 'typeorm';

export class PaymentIntentions1778370000000 implements MigrationInterface {
  name = 'PaymentIntentions1778370000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "payment_intentions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" character varying NOT NULL,
        "amount_egp" integer NOT NULL,
        "special_reference" character varying NOT NULL,
        "status" character varying(16) NOT NULL DEFAULT 'pending',
        "paymob_transaction_id" text,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_payment_intentions" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_payment_intentions_reference" UNIQUE ("special_reference")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "payment_intentions"`);
  }
}
