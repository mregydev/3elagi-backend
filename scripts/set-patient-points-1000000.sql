-- Give every patient a 1,000,000 credit balance (message_points is the
-- spendable balance PointsService checks before consultations and calls).
-- Idempotent: re-running leaves the same result.
--
-- points_reserved is deliberately untouched — it mirrors credits held by
-- consultations/calls that are still open, and zeroing it would desync them.

BEGIN;

UPDATE "users"
SET "message_points" = 1000000
WHERE "role" = 'patient';

-- Row count sanity check before you commit.
SELECT COUNT(*) AS patients_updated
FROM "users"
WHERE "role" = 'patient'
  AND "message_points" = 1000000;

COMMIT;
