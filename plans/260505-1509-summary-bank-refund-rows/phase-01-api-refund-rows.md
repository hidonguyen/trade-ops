# Phase 1 — API: emit refund rows in Chi/Thu khác

## Context
- File: `app/api/reports/summary/route.ts`
- Current behavior: REFUND tx netted into `periodPayment` (lines ~111-119); not surfaced as standalone rows (lines 261-262 comment).
- Order tx already fetched in `ordersWithTxs` query (line ~63 onward) including `paymentType`, `paymentMethod`, `id`, `transactionDate`, `amountOriginal`, currency, `bankReference`.

## Changes

### 1. Build refund rows from already-fetched order tx
After `saleOrders` / `purchaseOrders` split (~line 145), before standalone fetch:

```ts
function buildRefundRows(orders: typeof ordersWithTxs): StandaloneRow[] {
  const rows: StandaloneRow[] = [];
  for (const o of orders) {
    for (const t of o.transactions) {
      if (t.paymentType !== "REFUND") continue;
      if (t.paymentMethod === "DEPOSIT") continue;
      if (t.transactionDate < fromDate || t.transactionDate > toDate) continue;
      rows.push({
        rowType: "refund",
        id: t.id,
        date: t.transactionDate.toISOString(),
        amountOriginal: t.amountOriginal.toString(),
        currencyCode: o.currency.code,
        currencySymbol: o.currency.symbol,
        paymentMethod: t.paymentMethod,
        bankReference: t.bankReference,
        partyName: o.party.name,
        label: `Hoàn tiền — ${o.party.name} ${o.orderNumber}`,
        notes: null,
      });
    }
  }
  return rows;
}
const saleRefundRows = buildRefundRows(saleOrders);     // → otherPayments
const purchaseRefundRows = buildRefundRows(purchaseOrders); // → otherReceipts
```

### 2. Verify tx select includes needed fields
Lines ~63-80: ensure select has `id, paymentType, paymentMethod, bankReference, transactionDate, amountOriginal`. Add any missing.

### 3. Update StandaloneRow union (line 16)
```ts
rowType: "transaction" | "deposit" | "bankFee" | "refund";
```

### 4. Merge into otherReceipts/otherPayments (lines 263-270)
```ts
const otherReceipts = [
  ...buildStandaloneRows(receipts),
  ...customerDepositRows,
  ...purchaseRefundRows,
].sort((a, b) => a.date.localeCompare(b.date));
const otherPayments = [
  ...buildStandaloneRows(payments),
  ...supplierDepositRows,
  ...feeRows,
  ...saleRefundRows,
].sort((a, b) => a.date.localeCompare(b.date));
```

Remove the stale comment at lines 261-262.

## Todo
- [ ] Add `rowType: "refund"` to type union
- [ ] Verify tx select fields (add `id`, `paymentMethod`, `bankReference` if missing)
- [ ] Implement `buildRefundRows`
- [ ] Wire into `otherReceipts` / `otherPayments`
- [ ] Remove stale comment
- [ ] `npm run build` (or `tsc --noEmit`) compiles clean

## Success Criteria
- Hitting `/api/reports/summary?from=...&to=...` for a businessUnit with a SALE order having an in-period BANK REFUND returns the refund in `otherPayments[]` with correct label + amount.
- PURCHASE REFUND appears in `otherReceipts[]`.
- DEPOSIT-method REFUND absent.
- Existing periodPayment values unchanged.
