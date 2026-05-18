-- RBAC per Business Unit: scope role assignments to a BusinessUnit.
-- null businessUnitId = global scope (ADMIN convention).

-- 1. Add nullable businessUnitId column + FK.
ALTER TABLE "UserRoleAssignment" ADD COLUMN "businessUnitId" TEXT;

ALTER TABLE "UserRoleAssignment"
  ADD CONSTRAINT "UserRoleAssignment_businessUnitId_fkey"
  FOREIGN KEY ("businessUnitId") REFERENCES "BusinessUnit"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- 2. Drop old unique (userId, role) — must precede backfill which duplicates
--    rows. IF EXISTS guards against a non-default constraint/index name.
ALTER TABLE "UserRoleAssignment" DROP CONSTRAINT IF EXISTS "UserRoleAssignment_userId_role_key";
DROP INDEX IF EXISTS "UserRoleAssignment_userId_role_key";

-- 3. Backfill: every existing non-ADMIN assignment gets one row per BU,
--    preserving current effective access (a global role granted all BUs).
--    Backfill against ALL BUs — not only active ones — so access to a
--    temporarily-inactive BU is not silently dropped.
INSERT INTO "UserRoleAssignment" ("id", "userId", "role", "businessUnitId", "assignedAt", "assignedBy")
SELECT gen_random_uuid()::text, ura."userId", ura."role", bu."id", ura."assignedAt", ura."assignedBy"
FROM "UserRoleAssignment" ura
CROSS JOIN "BusinessUnit" bu
WHERE ura."role" <> 'ADMIN'
  AND ura."businessUnitId" IS NULL;

-- Delete a legacy global non-ADMIN row ONLY when a BU-scoped replacement now
-- exists — guarantees no access is wiped if there were zero BusinessUnits.
DELETE FROM "UserRoleAssignment" orig
WHERE orig."role" <> 'ADMIN'
  AND orig."businessUnitId" IS NULL
  AND EXISTS (
    SELECT 1 FROM "UserRoleAssignment" dup
    WHERE dup."userId" = orig."userId"
      AND dup."role" = orig."role"
      AND dup."businessUnitId" IS NOT NULL
  );

-- 4. New unique key + index.
CREATE UNIQUE INDEX "UserRoleAssignment_userId_role_businessUnitId_key"
  ON "UserRoleAssignment"("userId", "role", "businessUnitId");

CREATE INDEX "UserRoleAssignment_businessUnitId_idx"
  ON "UserRoleAssignment"("businessUnitId");
