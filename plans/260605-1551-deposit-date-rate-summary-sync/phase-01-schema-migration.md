---
phase: 1
title: Schema & Migration
status: completed
priority: P1
effort: 1h
dependencies: []
---

# Phase 1: Schema & Migration

## Overview

Add two columns to the `Deposit` model: `depositDate` (user-editable transaction date) and `exchangeRate` (rate for VND conversion on reports). Backfill existing rows: `depositDate = createdAt`, `exchangeRate = 1`.

## Requirements

- Functional: every deposit has a `depositDate` and an `exchangeRate`. New rows default `exchangeRate = 1`; `depositDate` is supplied by the API (defaults to "today" in the create route, Phase 2).
- Non-functional: zero-downtime migration; no NULLs left after backfill; mirror existing precision conventions.

## Architecture

Mirror `Order` fields exactly for consistency:
- `Order.orderDate DateTime` (`schema.prisma:167`) → `Deposit.depositDate DateTime`
- `Order.exchangeRate Decimal @default(1) @db.Decimal(18, 8)` (`schema.prisma:166`) → `Deposit.exchangeRate Decimal @default(1) @db.Decimal(18, 8)`

`depositDate` has no DB-level default (set by app like `orderDate`). The migration adds the column **nullable**, backfills existing rows from `createdAt`, then flips it to `NOT NULL` — **no temporary default is used** (the nullable-add → backfill → SET NOT NULL ordering is self-sufficient). Do NOT add `DEFAULT now()`; that would stamp existing rows with the migration timestamp instead of `createdAt`.

## Related Code Files

- Modify: `prisma/schema.prisma` (Deposit model, lines 123-141)
- Create: `prisma/migrations/{timestamp}_add_deposit_date_and_exchange_rate/migration.sql`

## Implementation Steps

1. Edit `prisma/schema.prisma` — add to `model Deposit` (place after `remainingOriginal`, before `notes`):
   ```prisma
   depositDate       DateTime
   exchangeRate      Decimal        @default(1) @db.Decimal(18, 8)
   ```
   Add an index that matches the report's actual predicate. The summary + export deposit queries filter `businessUnitId` + `source: "MANUAL"` + `depositDate` range (`summary/route.ts:184-188`, `export/route.ts:235-238`), so include `source`:
   ```prisma
   @@index([businessUnitId, source, depositDate])
   ```
2. Generate the migration WITHOUT auto-apply so the backfill can be hand-edited:
   `npx prisma migrate dev --name add_deposit_date_and_exchange_rate --create-only`
3. Edit the generated `migration.sql` so existing rows are backfilled and no NULL remains. Expected shape:
   ```sql
   ALTER TABLE "Deposit" ADD COLUMN "exchangeRate" DECIMAL(18,8) NOT NULL DEFAULT 1;
   ALTER TABLE "Deposit" ADD COLUMN "depositDate" TIMESTAMP(3);
   UPDATE "Deposit" SET "depositDate" = "createdAt" WHERE "depositDate" IS NULL;
   ALTER TABLE "Deposit" ALTER COLUMN "depositDate" SET NOT NULL;
   CREATE INDEX "Deposit_businessUnitId_source_depositDate_idx" ON "Deposit"("businessUnitId", "source", "depositDate");
   ```
   (Keep whatever column/index names Prisma generates; only ensure the backfill `UPDATE` runs between the ADD and the `SET NOT NULL`.)
4. Apply: `npx prisma migrate dev` (or `prisma migrate deploy` in CI). Run `npx prisma generate`.
5. Verify the Prisma Client type now exposes `depositDate` / `exchangeRate` on `Deposit`.

## Success Criteria

- [ ] `Deposit` model has `depositDate: DateTime` and `exchangeRate: Decimal(18,8) @default(1)`
- [ ] Migration backfills existing rows (`depositDate = createdAt`, `exchangeRate = 1`) with no NULLs
- [ ] `@@index([businessUnitId, source, depositDate])` created (matches report filter predicate)
- [ ] `npx prisma generate` succeeds; `npm run type-check` passes (no other code references the new fields yet)

## Risk Assessment

- Risk: `SET NOT NULL` fails if backfill `UPDATE` missing → mitigated by the ordered SQL in step 3.
- Risk: existing foreign-currency deposits get `exchangeRate = 1` (VND on report will equal original amount for them) → accepted per user decision; editable later via Phase 3 UI.

## Security Considerations

None — additive schema change, no auth/permission surface.

## Next Steps

Phase 2 consumes the new fields in validation + create/update routes.
