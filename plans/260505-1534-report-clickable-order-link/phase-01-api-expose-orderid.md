# Phase 1 — Expose orderId in report APIs

## Summary route (`app/api/reports/summary/route.ts`)
- `StandaloneRow` type: add `orderId: string | null`.
- `buildStandaloneRows` (standalone tx, no order link) → `orderId: null`.
- Deposit rows → `orderId: null`.
- Bank-fee rows: source `feeTxs` includes `order` relation; populate `orderId: t.order?.id ?? null` (need to add `id` to `order` select around line 198).
- Refund rows (just added): populate `orderId: o.id`.
- Debt rows (`buildDebtRows`) already have `orderId`.

## Cashflow route
- File: locate `/api/cashflow-report` or similar (grep for `CashflowTransaction` shape source).
- Add `orderId` (or `order.id`) to query select; map into row response.
- UI type `CashflowTransaction` adds `orderId: string | null`.

## Deposits route (`app/api/reports/deposits/route.ts`)
- Each usage row links via `transaction`. Confirm `transaction.orderId` is selectable; expose as `orderId` on usage row.

## Todo
- [ ] Summary: extend StandaloneRow + populate `orderId` in 4 builders
- [ ] Cashflow: select + map `orderId`
- [ ] Deposits: expose `orderId` per usage
- [ ] Compile clean

## Success Criteria
- `curl /api/reports/summary` returns `orderId` on every refund/bankFee row, null on standalone/deposit rows.
- Cashflow rows include `orderId` (null for non-order tx).
- Deposit usages include `orderId`.
