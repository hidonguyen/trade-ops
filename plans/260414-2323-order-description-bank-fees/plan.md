---
title: Order "Diễn giải" label + Bank Fee on Payment Transactions + Bank Fee Reports
created: 2026-04-14
status: completed
blockedBy: []
blocks: []
---

# Overview

Three linked changes:

1. **Order "Diễn giải"** — rename UI label of existing `Order.notes` field from "Ghi chú" → "Diễn giải" (DB column unchanged).
2. **Bank fee on payment transactions** — add `bankFeeOriginal` + `bankFeeVnd` to `Transaction` model. Only editable when `paymentMethod = BANK`. Customer debt cleared by full `amountOriginal` (no change to `paidAmount` logic); fee tracked separately as company expense.
3. **Bank fee reports** — dashboard KPI card + cashflow report column + dedicated `/reports/bank-fees` page + Excel export.

## Key Decisions (from validation)

- `notes` DB column stays; only UI label changes (no migration needed for #1).
- Bank fee stored in both currencies: `bankFeeOriginal` (same currency as transaction) + `bankFeeVnd` (computed client-side via same `exchangeRate`).
- Fee only present when `paymentMethod = BANK`; `NULL/0` otherwise.
- `paidAmount` of order = transaction `amountOriginal` (unchanged). Debt fully cleared; fee does not reduce debt settlement.
- Cashflow reports show **net cash received** = `sum(amountVnd) - sum(bankFeeVnd)`.

## Phases

| # | Phase | Status |
|---|-------|--------|
| 01 | Schema + migration: Transaction bankFee fields | completed |
| 02 | API: order-transaction create/list + cashflow/dashboard/summary queries | completed |
| 03 | UI: rename order "Ghi chú" → "Diễn giải" (form + detail) | completed |
| 04 | UI: bank fee input in order-transaction form + display in tx list | completed |
| 05 | Cashflow report: bank fee column + net cash | completed |
| 06 | New `/reports/bank-fees` page + API + Excel export | completed |
| 07 | Dashboard KPI card: bank fees this period | completed |

## Dependencies

- Phase 01 blocks 02, 04, 05, 06, 07.
- Phase 02 blocks 04, 05, 06, 07.
- Phase 03 independent of Phase 01.
- Phases 04–07 can run in parallel after 02.

## Related Files

- `prisma/schema.prisma` — Transaction model
- `app/api/orders/[id]/route.ts`, `app/api/orders/[id]/transactions/route.ts`
- `app/api/cashflow-report/route.ts`, `app/api/reports/dashboard/route.ts`, `app/api/reports/summary/route.ts`
- `components/order-form.tsx`
- `app/(dashboard)/orders/[id]/order-info-card.tsx`
- `lib/validation-schemas.ts`
- `app/(dashboard)/reports/page.tsx`

## Security / Access Control

- Bank fee report: visible to `ADMIN`, `ACCOUNTANT_SALE`, `ACCOUNTANT_PURCHASE`, `ACCOUNTANT_CASHFLOW`, `VIEWER` (R/O).
- Write access on transaction fee field follows existing transaction write RBAC.

## Open Questions

None blocking. If any arise during implementation, ask the user before inventing behavior.
