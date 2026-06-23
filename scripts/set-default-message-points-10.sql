-- Set default message points to 10 for new users and reset existing patients/doctors.
-- Safe to run manually against production/staging (idempotent for the UPDATE).

ALTER TABLE "users"
  ALTER COLUMN "message_points" SET DEFAULT 10;

UPDATE "users"
SET "message_points" = 10
WHERE "role" IN ('patient', 'doctor');
