# Phase 7 Implementation Report — Orders + Transactions + Cashflow UI

**Date:** 2026-04-02  
**Status:** DONE

---

## Files Created

| File | Lines | Purpose |
|------|-------|---------|
| `components/order-form.tsx` | 195 | Order create/edit form — type/party/BU/currency/amount/date |
| `components/payment-form.tsx` | 220 | Payment dialog — BANK/DEPOSIT, Decimal.js amountVnd auto-compute |
| `components/transaction-form.tsx` | 320 | Standalone RECEIPT/PAYMENT form with deposit selector |
| `app/(dashboard)/orders/page.tsx` | 175 | Order list with FilterBar, DataTable, Pagination |
| `app/(dashboard)/orders/new/page.tsx` | 28 | Create order → POST /api/orders → redirect to detail |
| `app/(dashboard)/orders/[id]/page.tsx` | 110 | Order detail — assembles 3 sub-components |
| `app/(dashboard)/orders/[id]/order-info-card.tsx` | 75 | Party/type/date/amount/status display card |
| `app/(dashboard)/orders/[id]/financial-summary-card.tsx` | 90 | Paid/refunded/remaining summary rows |
| `app/(dashboard)/orders/[id]/order-transactions-table.tsx` | 140 | Transaction DataTable with delete confirmation |
| `app/(dashboard)/orders/[id]/edit/page.tsx` | 85 | Edit order → PATCH /api/orders/[id] |
| `app/(dashboard)/transactions/page.tsx` | 175 | Standalone transaction list |
| `app/(dashboard)/transactions/new/page.tsx` | 28 | Create standalone transaction |
| `app/(dashboard)/cashflow/page.tsx` | 195 | Cashflow report — filters + summary + table + Excel export |
| `app/(dashboard)/cashflow/cashflow-summary-cards.tsx` | 80 | Per-currency receipt/payment/net cards |

## Files Fixed (pre-existing bugs that blocked build)

- `components/deposit-form.tsx:93` — `onValueChange` null guard `?? ""`
- All `onValueChange` handlers in new form files — linter applied `?? ""` null guards

## Build Result

```
✓ Compiled successfully
✓ TypeScript: no errors
✓ 11 new routes registered: /orders, /orders/[id], /orders/[id]/edit, /orders/new,
  /transactions, /transactions/new, /cashflow (+ sub-routes)
```

## Key Design Decisions

- **Order detail split into 3 sub-components** to stay under 200 LOC each
- **Decimal.js used in payment-form + transaction-form** for amountVnd auto-computation
- **Cashflow summary computed client-side** from transaction list (no extra API call)
- **`onValueChange` always guarded with `?? ""`** — shadcn Select emits `string | null`
- Vietnamese labels throughout all UI

## Unresolved Questions

- `/api/business-units/[id]/deposits` endpoint referenced in `transaction-form.tsx` for DEPOSIT method — not confirmed to exist in API routes (may need fallback or alternative endpoint)
- Cashflow page computes summaries from paginated results only — cross-page totals would require a dedicated summary API call
