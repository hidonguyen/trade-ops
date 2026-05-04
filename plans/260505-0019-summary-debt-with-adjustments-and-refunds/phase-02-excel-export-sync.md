# Phase 02 — Excel export sync

## Context
- File: `app/api/reports/summary/export/route.ts`
- Reference: Phase 01 of this plan (API canonical)

## Overview
- Priority: P1
- Status: pending (blocked by Phase 01)
- Mirror debt formulas + refund routing in Excel.

## Implementation Steps

1. **Drop `paymentMethod: { not: "DEPOSIT" }` constraint on order-tx include** — current export filters this in the order tx select, which would lose REFUND tx for adj-aware computations. Decision: keep the order-listing `where.transactions.some` filter (orders with PAYMENT in period), but include ALL tx via the relation:
   ```ts
   transactions: {
     select: {
       amountOriginal: true,
       amountVnd: true,
       bankFeeOriginal: true,
       bankFeeVnd: true,
       transactionDate: true,
       paymentType: true,
       paymentMethod: true,
     },
   },
   ```

2. **Update `buildOrderRows`** to apply effectiveValue + refund-aware formulas:
   - `effectiveValue = orderAmt + Σ(ADJ all)`
   - `priorDebt = max(effectiveValue − Σ(PAYMENT before) + Σ(REFUND before), 0)`
   - `paidThisTime = Σ(PAYMENT in period.amountOriginal − bankFeeOriginal)` (customer; supplier subtractFee=false)
   - `vndAmount = Σ(PAYMENT in period.amountVnd − bankFeeVnd)` (customer; supplier without fee)
   - `debtRemaining = max(effectiveValue − Σ(PAYMENT all) + Σ(REFUND all), 0)`

3. **Add refund query** for in-period order-linked REFUND tx (`paymentMethod ≠ DEPOSIT`):
   ```ts
   const refundTxs = await prisma.transaction.findMany({
     where: {
       businessUnitId: bu.id,
       paymentType: "REFUND",
       paymentMethod: { not: "DEPOSIT" },
       orderId: { not: null },
       transactionDate: { gte: fromDate, lte: toDate },
     },
     include: {
       currency: { select: { code: true } },
       order: { select: { type: true, orderNumber: true, party: { select: { name: true } } } },
     },
     orderBy: { transactionDate: "asc" },
   });
   ```

4. **Append refund rows** to receipt/payment lists:
   ```ts
   for (const t of refundTxs) {
     if (!t.order) continue;
     const row: OtherCashflowRow = {
       transactionDate: t.transactionDate,
       payerReceiver: t.order.party.name,
       description: `Hoàn tiền — ${t.order.party.name} ${t.order.orderNumber}`,
       paymentMethod: fmtPaymentMethod(t.paymentMethod),
       referenceCode: t.bankReference ?? "",
       currencyCode: t.currency.code,
       originalAmount: new Decimal(t.amountOriginal.toString()).toDecimalPlaces(0).toNumber(),
       vndAmount: new Decimal(t.amountVnd.toString()).toDecimalPlaces(0).toNumber(),
       notes: t.notes ?? null,
     };
     if (t.order.type === "SALE") otherPaymentRows.push(row);
     else otherReceiptRows.push(row);
   }
   ```

5. **Sort both lists** post-merge (already done for otherPayments; ensure otherReceiptRows is also sorted after deposit + refund append).

6. Compile check.

## Todo List
- [ ] Extend order tx select with paymentType, paymentMethod, bankFeeVnd
- [ ] Rewrite `buildOrderRows` with effectiveValue + REFUND-aware formulas
- [ ] Add refundTxs query
- [ ] Append refund rows to correct list by order.type
- [ ] Sort otherReceiptRows + otherPaymentRows
- [ ] Compile check
- [ ] Reconcile sample export with API output

## Success Criteria
- Excel `paidThisTime` matches API `periodPayment` for every order.
- Excel `debtBefore` and `debtRemaining` match API `priorDebt` and `remainingDebt`.
- IV.b includes refund rows for SALE orders; III.b includes refund rows for PURCHASE orders.

## Risk Assessment
- **Tx-include broadening adds rows (Low/Low)**: indexed by orderId; perf negligible.

## Security / Auth
- No change.

## Next Steps
- Phase 03 verifies UI rendering + CSV export columns.
