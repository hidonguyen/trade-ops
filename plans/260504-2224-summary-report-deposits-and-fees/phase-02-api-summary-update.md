# Phase 02 — API: summary route update

## Context Links
- File: `app/api/reports/summary/route.ts` (current 144 lines)
- Schema delta from Phase 01: `Deposit.source`
- Existing parallel logic in `app/api/reports/summary/export/route.ts` (lines 137-260) for reference

## Overview
- Priority: P1
- Status: pending (blocked by Phase 01)
- Update API to: deduct bank fees from customer TT, append manual deposits to otherReceipts/otherPayments, append bank-fee rows to otherPayments, with row-type discriminator.

## Key Insights
- Excel route already has the deposit/bank-fee logic — port it here, normalizing for the JSON consumer.
- Customer "TT lần này" = `Σ(amountOriginal - COALESCE(bankFeeOriginal, 0))`. Supplier side keeps `Σ amountOriginal`.
- Need a discriminator field `rowType` so UI can distinguish `"transaction" | "deposit" | "bankFee"` rows in the same array.
- Sort merged arrays by date ascending after concat.

## Requirements
- Functional:
  - Customer `periodPayment` net of fees.
  - `otherReceipts` includes manual customer deposits.
  - `otherPayments` includes manual supplier deposits + bank-fee rows from sale + purchase tx.
  - All standalone-tab rows share a unified shape with `rowType`.
- Non-functional: 1 added query for deposits, 1 for bankFee tx. Total ≤ 4 extra queries per request.

## Architecture
Data flow:
```
fetch ordersWithTxs (existing) → buildDebtRows (modified to subtract bankFee from periodPayment)
fetch standalone receipts/payments (existing)
+ fetch deposits where source=MANUAL, createdAt in period, party.type filter
+ fetch tx where bankFeeOriginal>0 in period
→ merge into otherReceipts (deposits w/ CUSTOMER|BOTH party) and otherPayments (deposits w/ SUPPLIER|BOTH party + bank fees)
→ sort by date asc
```

## Related Code Files

### Files to Modify
- `app/api/reports/summary/route.ts`

### Files to Read for Context
- `app/api/reports/summary/export/route.ts` lines 137-260 (already-validated logic)
- `prisma/schema.prisma` Deposit, Party, Transaction models

## Implementation Steps

1. **Update select on `ordersWithTxs.transactions`** (line 53-56) — add `bankFeeOriginal`:
   ```ts
   transactions: {
     where: { paymentType: "PAYMENT" },
     select: { amountOriginal: true, bankFeeOriginal: true, transactionDate: true },
   },
   ```

2. **Update `buildDebtRows`** (lines 62-92) — add a `subtractFee` flag param. For SALE orders, subtract `bankFeeOriginal` from each in-period tx before summing into `paidInPeriod`. Purchase orders keep current behavior.
   ```ts
   function buildDebtRows(orders: typeof ordersWithTxs, subtractFee: boolean) {
     return orders.map((order) => {
       // priorDebt computation unchanged (sum amountOriginal only)
       const paidInPeriod = order.transactions
         .filter((t) => t.transactionDate >= fromDate && t.transactionDate <= toDate)
         .reduce((s, t) => {
           const amt = new Decimal(t.amountOriginal.toString());
           const fee = subtractFee && t.bankFeeOriginal
             ? new Decimal(t.bankFeeOriginal.toString())
             : new Decimal(0);
           return s.plus(amt.minus(fee));
         }, new Decimal(0));
       // remainingDebt unchanged: based on full amountOriginal (fees don't reduce debt)
       const remainingDebt = Decimal.max(orderAmt.minus(paidBefore).minus(/* full payments in period */), 0);
       // ... rest
     });
   }
   ```
   IMPORTANT: `remainingDebt` must continue using full `amountOriginal` sum (not net of fee). Compute `paidInPeriodFull` separately for `remainingDebt`, and `paidInPeriodNet` for `periodPayment` output column.

3. **Call sites**:
   - `customerReceipts: buildDebtRows(saleOrders, true)`
   - `supplierPayments: buildDebtRows(purchaseOrders, false)`

4. **Define unified standalone row shape**:
   ```ts
   type StandaloneRow = {
     rowType: "transaction" | "deposit" | "bankFee";
     id: string;                  // tx id, deposit id, or `${txId}-fee`
     date: string;                // ISO
     amountOriginal: string;
     currencyCode: string;
     currencySymbol: string;
     paymentMethod: string | null; // null for deposits
     bankReference: string | null;
     partyName: string | null;     // null for legacy standalone tx (no party link)
     label: string;                // "Đặt cọc khách hàng" / "Phí ngân hàng — {party} {orderNumber}" / expenseType.name
     notes: string | null;
   };
   ```

5. **Modify `buildStandaloneRows`** to emit `rowType: "transaction"` and add `partyName: null`, `label: t.expenseType?.name ?? ""`.

6. **Add deposit fetch** (after line 119, parallelize with existing Promise.all):
   ```ts
   const deposits = await prisma.deposit.findMany({
     where: {
       businessUnitId,
       source: "MANUAL",
       createdAt: { gte: fromDate, lte: toDate },
     },
     include: {
       party: { select: { name: true, type: true } },
       currency: { select: { code: true, symbol: true } },
     },
     orderBy: { createdAt: "asc" },
   });
   ```

7. **Add bank-fee tx fetch** (sale + purchase, in period, with fee > 0):
   ```ts
   const feeTxs = await prisma.transaction.findMany({
     where: {
       businessUnitId,
       transactionDate: { gte: fromDate, lte: toDate },
       bankFeeOriginal: { gt: 0 },
     },
     include: {
       currency: { select: { code: true, symbol: true } },
       order: { select: { orderNumber: true, type: true, party: { select: { name: true } } } },
     },
     orderBy: { transactionDate: "asc" },
   });
   ```

8. **Build deposit rows** — split by party.type:
   ```ts
   const customerDepositRows: StandaloneRow[] = [];
   const supplierDepositRows: StandaloneRow[] = [];
   for (const d of deposits) {
     const row: StandaloneRow = {
       rowType: "deposit",
       id: d.id,
       date: d.createdAt.toISOString(),
       amountOriginal: d.amountOriginal.toString(),
       currencyCode: d.currency.code,
       currencySymbol: d.currency.symbol,
       paymentMethod: null,
       bankReference: null,
       partyName: d.party.name,
       label: d.party.type === "SUPPLIER" ? "Đặt cọc nhà cung cấp" : "Đặt cọc khách hàng",
       notes: d.notes,
     };
     if (d.party.type === "SUPPLIER") supplierDepositRows.push(row);
     else customerDepositRows.push(row);  // CUSTOMER and BOTH go to receipts
   }
   ```

9. **Build bank-fee rows** (all routed to otherPayments):
   ```ts
   const feeRows: StandaloneRow[] = feeTxs
     .filter((t) => t.bankFeeOriginal)
     .map((t) => ({
       rowType: "bankFee",
       id: `${t.id}-fee`,
       date: t.transactionDate.toISOString(),
       amountOriginal: t.bankFeeOriginal!.toString(),
       currencyCode: t.currency.code,
       currencySymbol: t.currency.symbol,
       paymentMethod: t.paymentMethod,
       bankReference: t.bankReference,
       partyName: t.order?.party.name ?? null,
       label: `Phí ngân hàng${t.order ? ` — ${t.order.party.name} ${t.order.orderNumber}` : ""}`,
       notes: null,
     }));
   ```

10. **Merge & sort** before response:
    ```ts
    const otherReceipts = [...buildStandaloneRows(receipts), ...customerDepositRows]
      .sort((a, b) => a.date.localeCompare(b.date));
    const otherPayments = [...buildStandaloneRows(payments), ...supplierDepositRows, ...feeRows]
      .sort((a, b) => a.date.localeCompare(b.date));
    ```

11. **Return shape** unchanged at top level; only inner row schemas evolve.

12. Run `npm run build` to confirm types.

## Todo List
- [ ] Add `bankFeeOriginal` to ordersWithTxs select
- [ ] Refactor `buildDebtRows` with `subtractFee` flag, dual sum (full vs net)
- [ ] Define unified `StandaloneRow` type with `rowType` discriminator
- [ ] Update `buildStandaloneRows` to populate new fields
- [ ] Add deposits query (source=MANUAL)
- [ ] Add bank-fee tx query
- [ ] Build customer/supplier deposit rows split by party.type
- [ ] Build fee rows
- [ ] Merge + sort otherReceipts/otherPayments
- [ ] Compile check
- [ ] Manual smoke: hit endpoint with known fixture date range

## Success Criteria
- For a SALE PAYMENT tx with amountOriginal=100, bankFeeOriginal=2 → customerReceipts row `periodPayment="98.0000"`, `remainingDebt` unchanged vs prior behavior.
- A manual customer deposit created in-period appears in `otherReceipts` with `rowType="deposit"`.
- A REFUND-sourced deposit does NOT appear (filtered by `source="MANUAL"`).
- A purchase tx with bankFeeOriginal=5 emits a row in `otherPayments` with `rowType="bankFee"`, `amountOriginal="5"`.
- Sort stable by date asc.

## Risk Assessment
- **Double-count fee (High/Med)**: if a tx is in customer-receipt section AND its fee row is in otherPayments, that's correct (separate cashflow lines), not double count. Mitigation: document in code comment.
- **Backfilled REFUND deposits leak (Med/Low)**: depends on Phase 01 backfill accuracy. Mitigation: spot-check before phase 02 ships.
- **Performance (Low/Low)**: 2 added queries indexed by businessUnitId/date. Negligible.

## Security Considerations
- Reuses existing `withAuth` + `checkAccess(GET, DASHBOARD)`. No change.

## Next Steps
- Phase 03 mirrors logic in Excel export (reconcile if export already differs).
- Phase 04 consumes `rowType` in UI.
