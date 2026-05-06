import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1777599963712 implements MigrationInterface {
  name = 'InitialSchema1777599963712';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "public"."users_role_enum" AS ENUM ('clinic_admin', 'doctor', 'patient');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "users" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "email" character varying NOT NULL,
        "password_hash" character varying NOT NULL,
        "role" "public"."users_role_enum" NOT NULL DEFAULT 'doctor',
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_users_email" UNIQUE ("email"),
        CONSTRAINT "PK_users" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "clinics" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying NOT NULL,
        "phone" character varying,
        "location" character varying,
        "permission_doc_url" character varying,
        "owner_id" uuid NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_clinics" PRIMARY KEY ("id"),
        CONSTRAINT "FK_clinics_owner" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "doctors" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "name" character varying NOT NULL,
        "age" integer,
        "phone" character varying,
        "photo_url" character varying,
        "graduation_cert_url" character varying,
        "work_permit_url" character varying,
        "default_clinic_id" uuid,
        "email" character varying,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_doctors" PRIMARY KEY ("id"),
        CONSTRAINT "FK_doctors_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_doctors_clinic" FOREIGN KEY ("default_clinic_id") REFERENCES "clinics"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "public"."clinic_join_requests_status_enum" AS ENUM ('pending', 'approved', 'rejected');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "clinic_join_requests" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "doctor_id" uuid NOT NULL,
        "clinic_id" uuid NOT NULL,
        "status" "public"."clinic_join_requests_status_enum" NOT NULL DEFAULT 'pending',
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_clinic_join_requests" PRIMARY KEY ("id"),
        CONSTRAINT "FK_join_requests_doctor" FOREIGN KEY ("doctor_id") REFERENCES "doctors"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_join_requests_clinic" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "patients" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "clinic_id" uuid NOT NULL,
        "name" character varying NOT NULL,
        "birth_date" date,
        "phone" character varying NOT NULL,
        "age" integer,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_patients" PRIMARY KEY ("id"),
        CONSTRAINT "FK_patients_clinic" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "public"."appointments_status_enum" AS ENUM ('waiting', 'active', 'done', 'cancelled');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "appointments" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "clinic_id" uuid NOT NULL,
        "doctor_id" uuid,
        "patient_id" uuid,
        "patient_name" character varying,
        "patient_phone" character varying NOT NULL,
        "date" date NOT NULL,
        "time" time,
        "status" "public"."appointments_status_enum" NOT NULL DEFAULT 'waiting',
        "queue_position" integer NOT NULL DEFAULT 0,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_appointments" PRIMARY KEY ("id"),
        CONSTRAINT "FK_appointments_clinic" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_appointments_doctor" FOREIGN KEY ("doctor_id") REFERENCES "doctors"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_appointments_patient" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "public"."medical_documents_type_enum" AS ENUM ('xray', 'lab', 'symptom', 'prescription', 'diagnosis');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_clinics_owner'
        ) THEN
          ALTER TABLE "clinics" ADD CONSTRAINT "FK_clinics_owner"
          FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        BEGIN
          ALTER TABLE "appointments" ALTER COLUMN "time" TYPE time USING "time"::time;
        EXCEPTION WHEN others THEN NULL; END;
      END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "medical_documents" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "patient_id" uuid NOT NULL,
        "type" "public"."medical_documents_type_enum" NOT NULL,
        "file_url" character varying,
        "notes" text,
        "file_name" character varying,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_medical_documents" PRIMARY KEY ("id"),
        CONSTRAINT "FK_medical_documents_patient" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "medical_documents"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."medical_documents_type_enum"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "appointments"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."appointments_status_enum"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "patients"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "clinic_join_requests"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."clinic_join_requests_status_enum"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "doctors"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "clinics"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."users_role_enum"`);
  }
}
