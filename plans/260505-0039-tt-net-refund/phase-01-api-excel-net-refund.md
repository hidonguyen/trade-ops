# Phase 01 — API + Excel: net-refund into periodPayment, drop refund rows

## Files
- `app/api/reports/summary/route.ts`
- `app/api/reports/summary/export/route.ts`

## Steps

### A. API (`app/api/reports/summary/route.ts`)
1. In `buildDebtRows`, compute `refundsInPeriod` and subtract from `paidInPeriod`. Allow negative result (drop `Decimal.max(.., 0)` for periodPayment — debt cols still clamp).
   ```ts
   const inPeriodRefunds = txs.filter(
     (t) => t.paymentType === "REFUND" &&
            t.transactionDate >= fromDate && t.transactionDate <= toDate
   );
   const refundedInPeriod = inPeriodRefunds.reduce(
     (s, t) => s.plus(new Decimal(t.amountOriginal.toString())),
     new Decimal(0)
   );
   const paidInPeriodNet = paidInPeriod.minus(refundedInPeriod);
   // periodPayment: paidInPeriodNet.toFixed(4)  // can be negative
   ```
2. Drop `refundTxs` query, `refundReceiptRows`/`refundPaymentRows` build, and refund-row spreads in `otherReceipts`/`otherPayments`.
3. Drop `"refund"` from `StandaloneRow.rowType` union.

### B. Excel (`app/api/reports/summary/export/route.ts`)
1. In `buildOrderRows`, compute `refundedInPeriod` (and `refundedVndInPeriod`) and subtract from `paidThisTime` and `vndInPeriod`. Allow negative.
2. Drop `refundTxs` query and refund-row appending.

## Todo
- [ ] API: subtract refundedInPeriod from paidInPeriod
- [ ] API: drop refund query + rows
- [ ] API: drop "refund" from rowType union
- [ ] Excel: subtract refundedInPeriod (orig + vnd) from paidThisTime + vndInPeriod
- [ ] Excel: drop refundTxs query + appending
- [ ] Compile check

## Success
- For SALE order with in-period payment=30 (fee=2) + refund=10: API `periodPayment="18.0000"`, Excel `paidThisTime=18`.
- Pure-refund period: payment=0, refund=15 → periodPayment=`-15.0000`, Excel `paidThisTime=-15`.
- `otherReceipts`/`otherPayments` contains no rows with `rowType="refund"`.

## Risks
- **Excel VND sign**: if renderer formats with currency mask, negative may render `(15)` or `-15`. Verify in smoke export.
