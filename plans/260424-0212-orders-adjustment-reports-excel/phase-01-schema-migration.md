# Phase 01 — Schema migration & seed

## Context Links

- Schema: `/Users/hido/trade-ops/prisma/schema.prisma`
- Seed: `/Users/hido/trade-ops/prisma/seed.ts`
- Precedent migration: `/Users/hido/trade-ops/prisma/migrations/20260415002454_add_order_expense_type/migration.sql`

## Overview

- Priority: P1
- Status: completed
- Adds `exchangeRate`, `paymentDueDate` to `Order`; adds `expenseTypeId` FK to `Transaction`; seeds new ExpenseType values.

## Key Insights

- `Order.amountOriginal` already `Decimal(18,4)`. Use same `Decimal(18,8)` for `exchangeRate` to match existing `Transaction.exchangeRate`.
- `Transaction.exchangeRate` exists; Order uses derived VND at display time. No new VND column on Order (keep single source of truth).
- ExpenseType has no unique constraint on `name` — seed uses `findFirst + create` pattern (already established).

## Requirements

**Functional**
- Add `Order.exchangeRate Decimal(18,8) NOT NULL DEFAULT 1` (backfill existing → 1)
- Add `Order.paymentDueDate DateTime?` (nullable)
- Add `Transaction.expenseTypeId String?` + FK to `ExpenseType(id)` + index
- Seed additional ExpenseType names: `"Mua vật tư"`, `"Chi phí tiện ích"`, `"Chi phí khác"`, `"Phí ngân hàng"`, `"Cọc"` (idempotent)

**Non-functional**
- Migration safe on prod (no data loss, no long locks on small tables)
- Seed idempotent — safe to re-run

## Architecture

```
Order (+ exchangeRate Decimal(18,8) DEFAULT 1, + paymentDueDate TIMESTAMP NULL)
Transaction (+ expenseTypeId TEXT NULL, FK → ExpenseType)
ExpenseType (seed 5 new rows if missing)
```

## Related Code Files

**Modify**
- `/Users/hido/trade-ops/prisma/schema.prisma`
- `/Users/hido/trade-ops/prisma/seed.ts`

**Create**
- `/Users/hido/trade-ops/prisma/migrations/{timestamp}_add_order_exchange_rate_payment_due_and_tx_expense_type/migration.sql`

## Implementation Steps

1. Edit `schema.prisma`:
   - `Order` model → add `exchangeRate Decimal @db.Decimal(18, 8) @default(1)` and `paymentDueDate DateTime?`.
   - `Transaction` model → add `expenseTypeId String?` + relation `expenseType ExpenseType? @relation(fields: [expenseTypeId], references: [id])` + `@@index([expenseTypeId])`.
   - `ExpenseType` model → add `transactions Transaction[]` inverse relation.
2. Create migration via `npx prisma migrate dev --name add_order_exchange_rate_payment_due_and_tx_expense_type` OR hand-craft SQL:
   ```sql
   ALTER TABLE "Order" ADD COLUMN "exchangeRate" DECIMAL(18,8) NOT NULL DEFAULT 1;
   ALTER TABLE "Order" ADD COLUMN "paymentDueDate" TIMESTAMP(3);
   ALTER TABLE "Transaction" ADD COLUMN "expenseTypeId" TEXT;
   CREATE INDEX "Transaction_expenseTypeId_idx" ON "Transaction"("expenseTypeId");
   ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_expenseTypeId_fkey"
     FOREIGN KEY ("expenseTypeId") REFERENCES "ExpenseType"("id") ON DELETE SET NULL ON UPDATE CASCADE;
   ```
3. Update `seed.ts`:
   - Extend `expenseTypeNames` array with the 5 required values. Existing `findFirst + create` loop handles idempotency.
4. Run `npx prisma generate` to refresh client types.
5. Run `npx tsc --noEmit` to catch downstream type errors (expect some in lib/order-status-calculator, lib/validation-schemas until phase 02; defer those).

## Todo List

- [x] Edit `schema.prisma` with new Order + Transaction fields
- [x] Add `transactions` inverse relation on `ExpenseType`
- [x] Generate migration SQL
- [x] Update `seed.ts` with new ExpenseType names
- [x] Run `prisma generate`
- [x] Verify migration applies clean on dev DB
- [x] Commit: `feat: add order exchange rate + due date + tx expense type`

## Success Criteria

- `prisma migrate status` clean after migration
- `SELECT "exchangeRate" FROM "Order"` returns `1` for all existing rows
- `SELECT name FROM "ExpenseType"` contains all 5 seeded names (+ existing)
- `prisma.transaction.findMany({ include: { expenseType: true } })` works without error

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Default `1` confuses users on non-VND orders | M | M | UI edit page prompts to update rate when `currency != VND && exchangeRate == 1` |
| ExpenseType duplicate names (no unique) | L | L | Existing `findFirst + create` pattern prevents duplication |
| Downstream type errors block build | M | L | Phases 02–04 fix these immediately; run `tsc --noEmit` after each |

## Security Considerations

- No RBAC changes. FK `ON DELETE SET NULL` prevents orphan cascade.

## Next Steps / Dependencies

- Unblocks: phase 02 (adjustment logic), phase 03 (UI), phase 04 (tx expense), phase 05 (Excel utils need field access)
