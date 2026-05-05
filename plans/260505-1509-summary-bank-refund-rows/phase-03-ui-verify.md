# Phase 3 — UI verify rendering + subtotals

## Context
- File: `app/(dashboard)/reports/summary/page.tsx`
- UI consumes `otherReceipts` / `otherPayments` already; new rows have `rowType: "refund"`.

## Changes
1. If row rendering branches on `rowType`, add a case for `"refund"` (style/icon optional — can render same as `transaction`).
2. Confirm subtotal aggregator sums every row's `amountOriginal` regardless of `rowType` (most likely already true). If filtered by `rowType`, extend filter.
3. Visual smoke test: load a period with a known refund, confirm row appears in correct tab with label "Hoàn tiền — {party} {orderNumber}".

## Todo
- [ ] Grep `rowType` in page.tsx; extend if-switch as needed
- [ ] Verify subtotal includes refund rows
- [ ] Manual browser check: SALE refund in Chi khác, PURCHASE refund in Thu khác
- [ ] Confirm "TT lần này" column unchanged

## Success Criteria
- Refund rows render with label, date, amount, currency.
- Chi/Thu khác subtotals = sum of all rows shown (incl. refunds).
- No console errors / TS warnings.
