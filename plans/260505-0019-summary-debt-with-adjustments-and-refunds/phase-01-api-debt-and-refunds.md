# Phase 01 — API: debt formulas + refund routing

## Context
- File: `app/api/reports/summary/route.ts` (current 200+ lines after prior plan)
- Reference for canonical formula: `lib/order-status-calculator.ts`, `app/api/orders/[id]/report/route.ts:69-82`

## Overview
- Priority: P1
- Status: pending
- Apply `effectiveValue` to debt cols, subtract REFUND in priorDebt/remainingDebt, route REFUND tx to standalone tabs by order type.

## Implementation Steps

1. **Widen order tx select** (currently filters `paymentType: "PAYMENT"`). Need ALL tx types (PAYMENT, REFUND, ADJUSTMENT) to compute formulas.
   ```ts
   transactions: {
     select: {
       amountOriginal: true,
       bankFeeOriginal: true,
       transactionDate: true,
       paymentType: true,
       paymentMethod: true,
     },
   },
   ```
   And drop the `where: { paymentType: "PAYMENT" }` filter on the tx-include.

2. **Update `buildDebtRows`** signature & body:
   ```ts
   function buildDebtRows(orders: typeof ordersWithTxs, subtractFee: boolean) {
     return orders.map((order) => {
       const orderAmt = new Decimal(order.amountOriginal.toString());

       const adjTotal = order.transactions
         .filter((t) => t.paymentType === "ADJUSTMENT")
         .reduce((s, t) => s.plus(new Decimal(t.amountOriginal.toString())), new Decimal(0));
       const effectiveValue = orderAmt.plus(adjTotal);

       const paymentsBefore = order.transactions
         .filter((t) => t.paymentType === "PAYMENT" && t.transactionDate < fromDate)
         .reduce((s, t) => s.plus(new Decimal(t.amountOriginal.toString())), new Decimal(0));
       const refundsBefore = order.transactions
         .filter((t) => t.paymentType === "REFUND" && t.transactionDate < fromDate)
         .reduce((s, t) => s.plus(new Decimal(t.amountOriginal.toString())), new Decimal(0));

       const paymentsAll = order.transactions
         .filter((t) => t.paymentType === "PAYMENT")
         .reduce((s, t) => s.plus(new Decimal(t.amountOriginal.toString())), new Decimal(0));
       const refundsAll = order.transactions
         .filter((t) => t.paymentType === "REFUND")
         .reduce((s, t) => s.plus(new Decimal(t.amountOriginal.toString())), new Decimal(0));

       // periodPayment = ONLY PAYMENT in period, optionally net of fees (customer side)
       const inPeriodPayments = order.transactions.filter(
         (t) => t.paymentType === "PAYMENT" &&
                t.transactionDate >= fromDate && t.transactionDate <= toDate
       );
       const paidInPeriod = subtractFee
         ? inPeriodPayments.reduce((s, t) => {
             const amt = new Decimal(t.amountOriginal.toString());
             const fee = t.bankFeeOriginal ? new Decimal(t.bankFeeOriginal.toString()) : new Decimal(0);
             return s.plus(amt.minus(fee));
           }, new Decimal(0))
         : inPeriodPayments.reduce(
             (s, t) => s.plus(new Decimal(t.amountOriginal.toString())),
             new Decimal(0)
           );

       const priorDebt = Decimal.max(
         effectiveValue.minus(paymentsBefore).plus(refundsBefore),
         new Decimal(0)
       );
       const remainingDebt = Decimal.max(
         effectiveValue.minus(paymentsAll).plus(refundsAll),
         new Decimal(0)
       );

       return {
         orderId: order.id,
         partyName: order.party.name,
         orderNumber: order.orderNumber,
         orderDate: order.orderDate.toISOString(),
         currencyCode: order.currency.code,
         currencySymbol: order.currency.symbol,
         priorDebt: priorDebt.toFixed(4),
         periodPayment: paidInPeriod.toFixed(4),
         remainingDebt: remainingDebt.toFixed(4),
         notes: order.notes,
       };
     });
   }
   ```

3. **Order-list filter** still selects orders with PAYMENT tx in period. Decision: keep as-is (an order with only REFUND in period but no PAYMENT will not appear in customer-receipts/supplier-payments tabs — its REFUND will surface in Chi khác/Thu khác via refund-row routing). Document this in code comment.

4. **Add REFUND tx fetch** (parallel with deposits/feeTxs):
   ```ts
   const refundTxs = await prisma.transaction.findMany({
     where: {
       businessUnitId,
       paymentType: "REFUND",
       paymentMethod: { not: "DEPOSIT" }, // skip refunds that credit a deposit (they appear via Deposit row)
       transactionDate: { gte: fromDate, lte: toDate },
       orderId: { not: null },
     },
     include: {
       currency: { select: { code: true, symbol: true } },
       order: {
         select: { type: true, orderNumber: true, party: { select: { name: true } } },
       },
     },
     orderBy: { transactionDate: "asc" },
   });
   ```

5. **Build refund rows**, route by `order.type`:
   ```ts
   const refundReceiptRows: StandaloneRow[] = [];
   const refundPaymentRows: StandaloneRow[] = [];
   for (const t of refundTxs) {
     if (!t.order) continue;
     const partyName = t.order.party.name;
     const row: StandaloneRow = {
       rowType: "refund",
       id: `${t.id}-refund`,
       date: t.transactionDate.toISOString(),
       amountOriginal: t.amountOriginal.toString(),
       currencyCode: t.currency.code,
       currencySymbol: t.currency.symbol,
       paymentMethod: t.paymentMethod,
       bankReference: t.bankReference,
       partyName,
       label: `Hoàn tiền — ${partyName} ${t.order.orderNumber}`,
       notes: t.notes,
     };
     if (t.order.type === "SALE") refundPaymentRows.push(row);
     else refundReceiptRows.push(row);
   }
   ```

6. **Extend `StandaloneRow.rowType`** union to include `"refund"`.

7. **Merge & sort** with new rows:
   ```ts
   const otherReceipts = [
     ...buildStandaloneRows(receipts),
     ...customerDepositRows,
     ...refundReceiptRows,
   ].sort((a, b) => a.date.localeCompare(b.date));
   const otherPayments = [
     ...buildStandaloneRows(payments),
     ...supplierDepositRows,
     ...feeRows,
     ...refundPaymentRows,
   ].sort((a, b) => a.date.localeCompare(b.date));
   ```

8. Compile check `npm run build`.

## Todo List
- [ ] Widen order tx select (drop PAYMENT-only filter, add paymentType+paymentMethod)
- [ ] Rewrite `buildDebtRows` with effectiveValue + refund-aware priorDebt/remainingDebt
- [ ] Add refundTxs query
- [ ] Build refundReceiptRows / refundPaymentRows by order.type
- [ ] Extend StandaloneRow rowType union to include "refund"
- [ ] Merge into otherReceipts/otherPayments and sort
- [ ] Compile check
- [ ] Manual smoke: SALE order with adj+refund matches order-detail balance

## Success Criteria
- For SALE: orderAmt=100, ADJ=+10, paid=80 (50 before, 30 in-period), refund=5 (in-period), fee=2 in-period
  - priorDebt = max(110 − 50 + 0, 0) = 60
  - periodPayment = 30 − 2 = 28
  - remainingDebt = max(110 − 80 + 5, 0) = 35
  - 1 refund row in otherPayments labeled "Hoàn tiền — {party} {orderNumber}", amount 5
- DEPOSIT-method REFUND tx does NOT emit refund row (handled via deposit movement).
- All numbers match `app/api/orders/[id]/report` output for the same order across full date range.

## Risk Assessment
- **Order-not-listed-when-only-refund-in-period (Med/Med)**: documented; mitigated by refund row appearing in Chi khác.
- **Adjustment double-counting (Low/Low)**: ADJUSTMENT tx is paymentType=ADJUSTMENT, never overlaps PAYMENT/REFUND filters.

## Security / Auth
- No change.

## Next Steps
- Phase 02 mirrors logic in Excel export.
