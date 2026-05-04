# Phase 03 — UI: extend rowType union + verify

## Context
- File: `app/(dashboard)/reports/summary/page.tsx`
- Phase 01 adds `rowType: "refund"` and a `Hoàn tiền — …` label.

## Overview
- Priority: P2
- Status: pending (blocked by Phase 01)
- Minimal change. Existing column renderer already handles `rowType` discriminator + label; only need to extend the type union and color-code refund rows.

## Implementation Steps

1. **Extend `StandaloneRow.rowType` union**:
   ```ts
   rowType: "transaction" | "deposit" | "bankFee" | "refund";
   ```

2. **Update Loại column renderer** to color refund rows orange (distinguishable from blue=deposit, red=bankFee):
   ```ts
   if (row.rowType === "refund") return <span className="text-orange-600">{text}</span>;
   ```

3. **Debt-column VND policy** (per user decision: no VND on debt cols). Current ORDER_COLUMNS already render only `<CurrencyAmount>` with `currencyCode` + `currencySymbol` — no VND number. Verify nothing leaks VND. No change needed if confirmed.

4. **Smoke test**:
   - Load page over date range with a known SALE order having ADJ + REFUND.
   - Verify priorDebt/remainingDebt match `/api/orders/{id}/report` for full date range.
   - Verify refund row appears in Chi khác for SALE / Thu khác for PURCHASE.
   - CSV export columns auto-derive — confirm header still correct.

5. Compile check.

## Todo List
- [ ] Extend rowType union with "refund"
- [ ] Add orange color for refund rows in Loại column
- [ ] Verify debt cols show no VND
- [ ] Smoke test all 4 tabs against sample data
- [ ] Compile check

## Success Criteria
- Refund rows visible with distinct color.
- No TS errors after union extension.
- Debt columns currency-only; no VND surfaces.

## Risk Assessment
- **Negligible**. UI change is purely additive on the rowType discriminator.

## Security / Auth
- Read-only page. No change.

## Next Steps
- Optional follow-up (not in scope): add a totals row summing periodPayment per currency.
