# Edit Payment & Overpayment Guard

**Created:** 2026-04-19
**Status:** completed
**Priority:** high
**Complexity:** medium (4-5 files, no schema changes)

## Summary

Enable editing existing payment transactions and prevent payments exceeding remaining order balance.

## Current State

- `PaymentForm` (components/payment-form.tsx) — CREATE only, no edit mode
- `OrderTransactionsTable` (orders/[id]/order-transactions-table.tsx) — DELETE only, no edit button
- PATCH API already exists at `app/api/orders/[id]/transactions/[txId]/route.ts`
- No overpayment validation anywhere (client or server)
- `recalculateOrderStatus` (lib/order-status-calculator.ts) recalculates after each tx change

## Phases

| # | Phase | Status | Files |
|---|-------|--------|-------|
| 1 | [Backend overpayment guard](./phase-01-backend-overpayment-guard.md) | completed | POST + PATCH route, overpayment-guard.ts |
| 2 | [Frontend edit mode + overpayment UX](./phase-02-frontend-edit-overpayment.md) | completed | payment-form, order-transactions-table, order detail page |

## Key Decisions

- Overpayment check on **server-side** (authoritative) + **client-side** (UX hint)
- Server rejects if `newNetPaid > orderAmount` for PAYMENT type
- For PATCH: exclude current transaction's amount when computing remaining balance
- REFUND transactions are NOT subject to overpayment check
- Client shows remaining balance + caps input hint (not hard cap — server is authority)

## Dependencies

- None — no schema changes, no new migrations
