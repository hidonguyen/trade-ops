# Phase 01 — Schema + migration

## Overview
- Priority: Critical
- Status: pending

Add `expenseTypeId` optional FK to `Order` and reverse relation.

## Schema changes (`prisma/schema.prisma`)

```prisma
model Order {
  // ... existing
  expenseTypeId   String?
  expenseType     ExpenseType? @relation(fields: [expenseTypeId], references: [id])
  // ... existing
  @@index([expenseTypeId])
}

model ExpenseType {
  // ... existing
  orders    Order[]
}
```

## Migration

```bash
npx prisma migrate dev --name add_order_expense_type
```

Expected SQL:
- `ALTER TABLE "Order" ADD COLUMN "expenseTypeId" TEXT`
- `CREATE INDEX ... ON "Order" ("expenseTypeId")`
- FK constraint

## Todo

- [ ] Add `expenseTypeId` + relation to Order
- [ ] Add reverse `orders` relation on ExpenseType
- [ ] Add index
- [ ] Run migration
- [ ] `npx prisma generate` + `npm run type-check`

## Success Criteria

- Existing rows have NULL. No constraint violation.
- Prisma client exposes `expenseType` relation on Order.

## Risks

- None. Optional + nullable = safe.
