# Phase 01 — Accountant role: view-only on payments

## Context

- `lib/rbac.ts` currently grants `ACCOUNTANT_CASHFLOW`: `RECEIPT: FULL`, `PAYMENT: FULL`. User requires VIEW-only on sales/purchases AND no payment create/edit.
- Background: commit `23eee13` enforces matrix in API/UI. We only change matrix values; enforcement stays.

## Requirements

- `ACCOUNTANT_CASHFLOW` must have `RECEIPT: GET`, `PAYMENT: GET` (no POST/PUT/DELETE).
- `SALE` and `PURCHASE` already `GET` — keep.
- Other roles unchanged.

## Files

- Modify: `lib/rbac.ts`

## Implementation steps

1. Edit `lib/rbac.ts` line 17-20: change `RECEIPT: "FULL"` → `"GET"` and `PAYMENT: "FULL"` → `"GET"` for `ACCOUNTANT_CASHFLOW`.
2. Verify no test depends on cashflow role having FULL payment.
3. Manually verify in UI: log in as accountant-cashflow, payment "Tạo mới" button hidden; API POST `/api/transactions` returns 403.

## Todo

- [ ] Update permission matrix
- [ ] Run `pnpm tsc --noEmit`
- [ ] Verify UI gates hide create/edit/delete buttons for ACCOUNTANT_CASHFLOW
- [ ] Verify API returns 403 on POST /api/transactions

## Success criteria

- ACCOUNTANT_CASHFLOW can view payments/receipts but cannot create/edit/delete.
- No regression for ADMIN, ACCOUNTANT_SALE, ACCOUNTANT_PURCHASE, VIEWER.

## Risks

- **Low**: matrix change is data-only. Mitigation: smoke test with each role.

## Rollback

- Revert single-file change.
