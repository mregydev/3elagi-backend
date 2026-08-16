-- Reset every account to the 200-point signup grant, and align the column
-- default with DEFAULT_MESSAGE_POINTS (src/points/points.constants.ts).
--
-- Run manually against staging/production. Idempotent: running it twice leaves
-- the same state. It OVERWRITES balances, so top-ups people already bought are
-- wiped too — take a dump first if that matters.
--
--   psql "$DATABASE_URL" -f scripts/reset-all-points-to-200.sql

BEGIN;

ALTER TABLE "users"
  ALTER COLUMN "message_points" SET DEFAULT 200;

UPDATE "users"
SET
  "message_points" = 200,
  -- Holds from consultations that never settled would otherwise keep eating
  -- into the fresh balance; consultations cost 0 now, so nothing should be held.
  "points_reserved" = 0
WHERE "role" IN ('patient', 'doctor');

COMMIT;

-- Check:
--   SELECT role, count(*), min(message_points), max(message_points)
--   FROM users GROUP BY role;
