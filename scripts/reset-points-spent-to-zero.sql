-- Reset lifetime "used" and "purchased" points for every user.
-- Does not change available balance (message_points).
-- Safe to re-run.

UPDATE "users"
SET
  "points_spent_total" = 0,
  "points_purchased_total" = 0
WHERE "points_spent_total" IS DISTINCT FROM 0
   OR "points_purchased_total" IS DISTINCT FROM 0;

-- Optional: verify
-- SELECT id, email, role, message_points, points_spent_total, points_purchased_total
-- FROM "users"
-- ORDER BY role, email;
