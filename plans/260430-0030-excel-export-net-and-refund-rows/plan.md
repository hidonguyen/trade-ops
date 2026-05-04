---
title: Apply net-paid formula to Excel exports + show refund rows in detail sheet
description: Update sales/purchase detail and summary Excel exports so "ĐÃ THANH TOÁN" reflects net (paid − refund) per the list-page formula; add REFUND transaction rows interleaved with PAYMENT rows in detail sheets (negative-signed amounts so column sums match the net total)
status: completed
completed: 2026-04-30
priority: P3
effort: ~1h
branch: main
tags: [reports, excel, exports, orders]
created: 2026-04-30
blockedBy: []
blocks: []
---

# Plan: Net-paid Excel exports + refund rows

## Context

Recent UI work split into two display patterns:
- **List page** "Đã thanh toán" = net (paid − refund)
- **Detail page** `FinancialSummaryCard` "Đã thanh toán" = gross + breakdown rows

User requested Excel exports follow the **list-page net formula** (one column = net) AND show **REFUND rows interleaved with PAYMENT rows** in detail sheets (so the column sums to net).

`Order.balanceOriginal` already uses `effective − paid + refunded` (correct under any presentation). No formula change there.

## Affected exports

| Export | File | Today | Target |
|---|---|---|---|
| Sales detail | `lib/excel-sales-detail-service.ts` (SALE branch) | Col 10 = gross paid; no refund rows | Col 10 = net paid; refund rows with negative amounts |
| Purchase detail | same file (PURCHASE branch) | same | same |
| Sales summary | `lib/excel-order-reports-service.ts` | Col 9 "ĐÃ THANH TOÁN" = gross paid | Col 9 = net paid |
| Purchase summary | same file | same | same |
| (out of scope) `summary/export` | `lib/excel-cashflow-summary-service.ts` | uses cashflow formula, not order formula | unchanged |

## Decisions (locked)

1. **"ĐÃ THANH TOÁN" everywhere = `paidAmount − refundedAmount`** (net). No separate "ĐÃ HOÀN TIỀN" column added (would clutter and contradict the chosen single-column style).
2. **Detail sheet per-order section**: emit one row per transaction (PAYMENT or REFUND).
   - PAYMENT row → col 10 = +amount
   - REFUND row → col 10 = −amount (Excel formats negative red automatically with existing number style; no extra column needed)
   - Column 9 ("NGÀY TT") = transaction date (same field for both)
3. **Total row** col 10 = `netPaid = paidAmount − refundedAmount`. Col 11 (CÒN PHẢI TT = balance) unchanged — formula already correct.
4. **Grand totals** sum the net values per currency.
5. **`order-aggregates.ts`**: add `netPaidAmount` to `OrderAggregates` for downstream convenience. `extractPayments` extended (or new `extractTransactions`) to return both PAYMENT and REFUND with a sign-aware amount.

## Scope

| Layer | File | Change |
|---|---|---|
| Aggregate helper | `lib/order-aggregates.ts` | Add `netPaidAmount` field; new helper `extractPaymentsAndRefunds` (returns rows with signed amount + type marker, sorted by date) |
| Detail Excel | `lib/excel-sales-detail-service.ts` | Use signed-row helper; total row uses `netPaidAmount`; grand totals sum net |
| Summary Excel | `lib/excel-order-reports-service.ts` | Replace `paidAmount` (gross) with `netPaidAmount` in row + grand-total math |
| Helper types | `lib/excel-order-reports-helpers.ts` | Type interface adjustment (replace/augment `paidAmount` with `netPaidAmount`) |
| API routes | `app/api/reports/sales-detail/export/route.ts`, `purchase-detail/export/route.ts`, `sales-summary/export/route.ts`, `purchase-summary/export/route.ts` | Pass `refundedAmount` + `netPaidAmount` from aggregates into the export shape |

## Implementation outline

### 1. `lib/order-aggregates.ts`

```ts
export interface OrderAggregates {
  adjustmentTotal: number;
  effectiveValue: number;
  paidAmount: number;       // gross PAYMENT
  refundedAmount: number;   // gross REFUND
  netPaidAmount: number;    // paid − refunded (NEW)
  balanceOriginal: number;
}

// In computeOrderAggregates:
const netPaidAmount = paidAmount.minus(refundedAmount);
return { ..., netPaidAmount: netPaidAmount.toNumber(), ... };

// New helper (replaces extractPayments at call sites):
export function extractPaymentsAndRefunds(transactions: RawTransaction[]) {
  return transactions
    .filter((tx) => tx.paymentType === "PAYMENT" || tx.paymentType === "REFUND")
    .sort((a, b) => a.transactionDate.getTime() - b.transactionDate.getTime())
    .map((tx) => {
      const amt = new Decimal(tx.amountOriginal.toString()).toNumber();
      return {
        transactionDate: tx.transactionDate,
        // REFUND amounts negated so column 10 sums to net
        amountOriginal: tx.paymentType === "REFUND" ? -amt : amt,
        type: tx.paymentType, // for callers that want a marker
        notes: tx.notes ?? null,
      };
    });
}
```

Keep the existing `extractPayments` (PAYMENT-only) export to avoid breaking other callers; just add the new helper. (Verify no callers rely on it being PAYMENT-only after the migration; if not, deprecate.)

### 2. Detail Excel — `lib/excel-sales-detail-service.ts`

- Replace `o.payments` iteration with combined `o.transactions` (PAYMENT + REFUND signed) sourced from new helper.
- Per-row col 10 already prints the number; negatives format red via `applyNumberFormat` (numFmt with negative variant) — verify, otherwise add explicit format.
- Total row col 10 → `o.netPaidAmount` instead of `o.paidAmount`.
- Grand totals object: rename `paid` → `netPaid` (still a `Decimal` accumulator).

```ts
// Iterate combined rows:
for (const tx of o.transactions) {
  const txRow: (string | number)[] = [
    o.businessUnitCode, o.partyName, o.orderNumber,
    formatDateDdMmYyyy(o.orderDate), o.currencyCode,
    "", "",
    dueDate,
    formatDateDdMmYyyy(tx.transactionDate),
    tx.amountOriginal,         // negative for REFUND
    "", "",
  ];
  if (isPurchase) txRow.push("");
  txRow.push(tx.notes ?? "");
  sheet.addRow(txRow);
}

// Total row:
const totalRow: (string | number)[] = [
  ...,
  value.toNumber(), discount.toNumber(),
  dueDate,
  "",
  o.netPaidAmount,  // was o.paidAmount
  balance.toNumber(),
  ...
];
```

Number format for col 10 should display negative in red — check `applyNumberFormat` impl; if it uses `'#,##0'`, switch to `'#,##0;[Red]-#,##0'`.

### 3. Summary Excel — `lib/excel-order-reports-service.ts`

Replace at lines 134-148:

```ts
const paid = new Decimal(o.netPaidAmount); // was o.paidAmount
```

Grand-total accumulator stays the same (renamed for clarity if desired).

### 4. Helper types — `lib/excel-order-reports-helpers.ts`

Change `paidAmount: number` → `netPaidAmount: number` (or add it; remove gross usage). Match shape in summary route.

### 5. API routes

Each export route currently does:
```ts
const agg = computeOrderAggregates(o.amountOriginal, o.transactions);
return { ..., paidAmount: agg.paidAmount, ... };
```

Change to:
```ts
return { ..., netPaidAmount: agg.netPaidAmount, refundedAmount: agg.refundedAmount, transactions: aggExtracted, ... };
```

For detail routes: also pass the combined `transactions` (signed) instead of `payments`.

## Edge cases

| Case | Behavior |
|---|---|
| Order with REFUND but no PAYMENT | netPaid < 0; col 10 negative; balance = effective + refund (max-clamped at 0 if effective small). Match current order-aggregates math. |
| REFUND on the same day as PAYMENT | Sort by date+createdAt? Existing helper sorts by `transactionDate` only — order between same-day rows is undefined but stable enough. Acceptable. |
| Negative numbers formatted in Excel | Confirm `applyNumberFormat` handles `[Red]` negative; otherwise update format string. |
| ADJUSTMENT transactions | Excluded from new helper (only PAYMENT/REFUND included). They're already in col 7 GIẢM GIÁ TRỊ ĐH. |
| Subtotal/grand-total rounding | Use Decimal accumulators; convert with `.toNumber()` only at write-time. |
| Existing `extractPayments` callers | After migration, only used by detail service. Decide: keep + new helper, or replace and update all callers. Safer = keep both, mark old as deprecated. |

## Acceptance criteria

- [ ] Detail Excel: REFUND rows appear interleaved with PAYMENT rows, dated, with negative amount in col 10.
- [ ] Detail Excel: total row col 10 = net paid (gross paid − refund); col 11 unchanged (balance correct).
- [ ] Summary Excel: col 9 "ĐÃ THANH TOÁN" = net for each row; grand-total likewise.
- [ ] `order-aggregates.netPaidAmount` field present and == paid − refunded.
- [ ] `npm run type-check` clean.
- [ ] Manual: order with paid 600K + refund 100K → Excel shows 600 + (−100) rows, total 500.
- [ ] Manual: order with no refunds → behavior identical to current export (no regression).

## Risks

- **Negative number formatting**: if Excel cell format doesn't show negatives correctly (e.g., parens or red), verify via opened export.
- **Backwards compatibility for downstream consumers** that read these Excel files: column 10 value semantics change from gross to net. Document in commit message; mention to user if external systems consume these files.
- **`extractPayments` deprecation**: keep both helpers to avoid breaking unknown callers; remove later if grep confirms no external use.
- **Subtotal formulas inside Excel sheet** (if any cell formula): currently subtotals are Map-aggregated in JS, not Excel `=SUM()` — safe.

## Phases

Single phase — all changes are tightly coupled (shape of aggregate flows through helpers + services + routes).

## Todo

- [x] Add `netPaidAmount` to `OrderAggregates`; new helper `extractPaymentsAndRefunds`
- [x] Update detail service to iterate combined tx rows + total uses `netPaidAmount`
- [x] Update summary service to use `netPaidAmount`
- [x] Update helper interface (`SalePaymentForExport`→`SaleTransactionForExport`, `paidAmount`→`netPaidAmount`, `payments`→`transactions`) + 4 export routes
- [x] Number format `#,##0;[Red]-#,##0` applied to col 10 (detail) / col 9 (summary)
- [x] Removed dead `extractPayments` (YAGNI per code review)
- [x] `npm run type-check`
- [ ] Manual: open exported file with refund-containing order; verify negative row + net total

## Open questions

1. Should the existing column header "THANH TOÁN LẦN NÀY" (per-row label) be renamed to something like "GIAO DỊCH" or "TT/HOÀN" since it now also holds refunds? Default: keep label, rely on negative sign + transaction notes.
2. Total row "ĐÃ THANH TOÁN" header — clarify as "ĐÃ THANH TOÁN (RÒNG)" or keep terse? Default: keep terse; negative-signed refund rows above make context clear.
3. Should `summary/export` (cashflow summary) also be touched? Current scope says no; it uses different aggregation. Confirm if user expects symmetric treatment.
