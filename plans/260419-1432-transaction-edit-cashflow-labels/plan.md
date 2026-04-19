# Transaction Edit UI + Cashflow Type Labels

**Created:** 2026-04-19
**Status:** completed
**Priority:** high
**Complexity:** medium (5-6 files, no schema changes)

## Summary

1. Add edit/delete UI to standalone transactions list page
2. Proper transaction type labels in cashflow report: "Thu bán hàng" for SALE_PAYMENT, "Chi mua hàng" for PURCHASE_PAYMENT

## Current State

- PATCH API already exists at `app/api/transactions/[id]/route.ts`
- `TransactionForm` (`components/transaction-form.tsx`) — CREATE only, no edit mode, lives on `/transactions/new` page
- Transactions list page (`app/(dashboard)/transactions/page.tsx`) — no edit/delete buttons
- Cashflow page shows "Thu"/"Chi" for all tx types — doesn't distinguish order-linked from standalone
- Transaction.type: RECEIPT, PAYMENT (standalone), SALE_PAYMENT, PURCHASE_PAYMENT (order-linked)

## Phases

| # | Phase | Status | Files |
|---|-------|--------|-------|
| 1 | [Transaction edit UI + actions](./phase-01-transaction-edit-ui.md) | completed | transaction-edit-dialog, transactions/page, PATCH schema |
| 2 | [Cashflow type labels](./phase-02-cashflow-type-labels.md) | completed | cashflow/page |

## Key Decisions

- TransactionForm edit mode: open as dialog (like PaymentForm), NOT navigate to /transactions/[id]/edit
- Lock type, paymentMethod, currency in edit mode (same rationale as PaymentForm)
- PATCH schema fix: add `.nullable()` for bankReference/notes (same bug as order tx)
- Type labels shared as constant map: `TYPE_LABELS = { RECEIPT: "Thu", PAYMENT: "Chi", SALE_PAYMENT: "Thu bán hàng", PURCHASE_PAYMENT: "Chi mua hàng" }`

## Dependencies

- None — no schema changes
- Blocked by: none
- Blocks: none
