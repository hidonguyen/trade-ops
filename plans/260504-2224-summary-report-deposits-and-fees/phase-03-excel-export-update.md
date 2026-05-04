# Phase 03 — Excel export sync

## Context Links
- File: `app/api/reports/summary/export/route.ts` (286 lines)
- Lib: `lib/excel-cashflow-summary-service.ts` (renderer; do NOT touch unless types need extending)
- Phase 02 logic is the canonical reference

## Overview
- Priority: P1
- Status: pending (blocked by Phase 01)
- Excel already has deposit + bank-fee logic but needs three corrections:
  1. Customer order rows must subtract `bankFeeOriginal` from `paidThisTime`.
  2. Filter deposits by `source: "MANUAL"`.
  3. Bank-fee rows must include party + orderNumber in description (currently shows `GD #xxx`).

## Key Insights
- `bankFeeTxs` query (line 170) currently fetches every tx with fee — already correct in scope; just enrich with order relation for label.
- `paymentMethod: { not: "DEPOSIT" }` filter is intentional (DEPOSIT-method payments belong to deposit movement section, not standalone). Keep as-is.

## Requirements
- Functional: Excel customer rows show net `paidThisTime`. Excel `otherPayments` shows manual deposits + fee rows with party-aware labels. REFUND deposits excluded.
- Non-functional: keep query count flat.

## Files to Modify
- `app/api/reports/summary/export/route.ts`

## Implementation Steps

1. **Extend orders query select** (line 70-82) — add `bankFeeOriginal: true`:
   ```ts
   select: {
     amountOriginal: true,
     amountVnd: true,
     bankFeeOriginal: true,
     transactionDate: true,
   },
   ```

2. **Modify `buildOrderRows`** (lines 86-131):
   - Add `subtractFee: boolean` param.
   - When `subtractFee=true`, compute `paidThisTime` net of fee:
     ```ts
     const paidThisTime = inPeriodTxs.reduce((s, t) => {
       const amt = new Decimal(t.amountOriginal.toString());
       const fee = subtractFee && t.bankFeeOriginal
         ? new Decimal(t.bankFeeOriginal.toString())
         : new Decimal(0);
       return s.plus(amt.minus(fee));
     }, new Decimal(0));
     ```
   - `paidBefore` and `debtRemaining` MUST use full `amountOriginal` sum (compute separately as `paidInPeriodFull` for debtRemaining math).
   - Call sites:
     - `customerReceipts = buildOrderRows(orders.filter(SALE), true)`
     - `supplierPayments = buildOrderRows(orders.filter(PURCHASE), false)`

3. **Filter deposits by source** (line 183-193). Add to `where`:
   ```ts
   source: "MANUAL",
   ```

4. **Enrich bankFeeTxs query** (line 170-180) with order relation:
   ```ts
   include: {
     currency: { select: { code: true } },
     order: { select: { orderNumber: true, party: { select: { name: true } } } },
   },
   ```

5. **Improve bank-fee row label** (line 222-237):
   ```ts
   const partyLabel = t.order
     ? `${t.order.party.name} ${t.order.orderNumber}`
     : `GD #${t.id.slice(-6)}`;
   otherPaymentRows.push({
     transactionDate: t.transactionDate,
     payerReceiver: t.order?.party.name ?? "",
     description: `Phí ngân hàng — ${partyLabel}`,
     // ... rest unchanged
   });
   ```

6. **Compile check**: `npm run build`. Excel renderer types should be unchanged.

7. **Manual verification**: export for a date range with a known SALE payment (amountOriginal=100, fee=2) and confirm:
   - Customer row `paidThisTime` = 98.
   - Bank-fee row appears in IV.b with description `Phí ngân hàng — {customer} {orderNumber}`.

## Todo List
- [ ] Add `bankFeeOriginal` to orders tx select
- [ ] Add `subtractFee` param to `buildOrderRows`, compute dual sums
- [ ] Update SALE/PURCHASE call sites
- [ ] Add `source: "MANUAL"` filter to deposits query
- [ ] Enrich bankFeeTxs query with order/party
- [ ] Update bank-fee row description to include party + order
- [ ] Compile check
- [ ] Generate sample Excel and eyeball values

## Success Criteria
- Customer III.a `paidThisTime` matches API `periodPayment` from Phase 02.
- Supplier IV.a unchanged from current export.
- IV.b deposit rows only contain manual deposits (no refund-sourced).
- Bank-fee rows show readable party + order reference.

## Risk Assessment
- **Renderer signature mismatch (Low/Low)**: shape unchanged. Mitigation: only field values change.
- **Drift from API logic (Med/Med)**: same logic in two places. Mitigation: write helper `subtractFeeFromPaid(txs)` shared between routes — defer if YAGNI; document parity test in checklist.

## Security Considerations
- No change.

## Next Steps
- Phase 04 UI consumes API (Phase 02), unrelated to this file.
