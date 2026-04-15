---
title: Add "Loại chi phí" (ExpenseType) to purchase orders
created: 2026-04-15
status: completed
blockedBy: []
blocks: []
---

# Overview

Add optional `expenseTypeId` to `Order` for PURCHASE orders. SALE orders ignore the field.

Scope confirmed:
- Optional (no backfill).
- New column on purchase-order list.
- Filter by ExpenseType on purchase-order list.
- New summary report: totals by ExpenseType per period.

## Phases

| # | Phase | Status |
|---|-------|--------|
| 01 | Schema + migration: `Order.expenseTypeId` nullable FK | completed |
| 02 | API: order CRUD + list filter + new `/api/reports/expense-type-summary` | completed |
| 03 | UI: form (PURCHASE only), detail card, list column + filter, summary report | completed |

## Dependencies

01 blocks 02 + 03. 02 and 03 can run in parallel after 01.

## Related Files

- `prisma/schema.prisma` — Order model + Order ↔ ExpenseType relation
- `app/api/orders/route.ts`, `app/api/orders/[id]/route.ts`
- `app/api/reports/expense-type-summary/route.ts` (new)
- `lib/validation-schemas.ts`
- `components/order-form.tsx`
- `app/(dashboard)/orders/page.tsx`
- `app/(dashboard)/orders/[id]/order-info-card.tsx`
- `app/(dashboard)/reports/page.tsx` — add tab/link

## Open Questions

- Delete/deactivate handling: if an ExpenseType is deactivated, keep existing order links intact. Form hides inactive types. (Reasonable default — confirm only if user objects.)
