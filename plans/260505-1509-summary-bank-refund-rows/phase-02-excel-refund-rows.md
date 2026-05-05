# Phase 2 — Excel export parity

## Context
- File: `app/api/reports/summary/export/route.ts`
- Mirror Phase 1 logic for the .xlsx export path. Comment at line 304 ("Refund tx are netted... not surfaced here") is the spot to revise.

## Changes
1. Inside the loop building order rows (~line 70+), refunds are already iterated for netting. Reuse that iteration to ALSO collect refund rows per order with `order.type` so they can be routed.
2. After computing `paidThisTime` etc., emit a row object per non-DEPOSIT REFUND tx in period:
   - SALE → push into the supplier/payments-side cashflow rows array (Chi khác section)
   - PURCHASE → push into the customer/receipts-side rows array (Thu khác section)
   - Fields: date, party, orderNumber, label `"Hoàn tiền — {party} {orderNumber}"`, amountOriginal, currency, VND if exported elsewhere, paymentMethod, bankReference.
3. Sort merged rows by date ASC (consistent with existing logic).
4. Subtotals/totals at the bottom of Chi/Thu khác sections must include the new refund amounts.
5. Remove stale comment at line 304.

## Todo
- [ ] Locate Chi khác / Thu khác section builders (search for `otherPayments`/`otherReceipts` analogs in export)
- [ ] Add refund rows to both arrays with correct routing
- [ ] Verify subtotal aggregator picks them up
- [ ] Compare against API JSON for one sample order: amounts and row count match
- [ ] `npm run build` clean

## Success Criteria
- Export and API agree on Chi khác / Thu khác row count and totals for a sample period containing SALE+PURCHASE refunds.
- DEPOSIT-method REFUND not exported as a row.
- TT lần này column unchanged from current behavior.
