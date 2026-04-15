# Phase 05 — Cashflow report: bank fee column + net cash

## Overview
- Priority: High
- Status: pending
- Depends on: Phase 02

## Requirements

- Per-row columns: `Amount VND`, **new** `Bank Fee VND`, **new** `Net VND` (= amount − fee).
- Summary totals include `Total Bank Fee VND` + `Net Cash VND`.
- Excel export includes same columns.
- Filters unchanged.

## Files

- `app/api/cashflow-report/route.ts` — include `bankFeeVnd`, `netVnd` in each row + totals.
- `app/(dashboard)/cashflow/page.tsx` — table columns + totals footer.
- Excel export helper (locate via grep `exceljs` in cashflow path) — add 2 columns.

## Steps

1. API: SELECT `bankFeeVnd` (coalesce NULL → 0); compute `netVnd = amountVnd - coalesce(bankFeeVnd, 0)`.
2. Update totals to sum fee + net alongside existing amount total.
3. UI: render new columns + totals row.
4. Excel export: add columns + totals.
5. Type-check + visual test.

## Todo

- [ ] API returns `bankFeeVnd` + `netVnd` per row + totals
- [ ] UI renders 2 new columns
- [ ] Totals footer shows fee total + net total
- [ ] Excel export includes both columns
- [ ] Visual check with mixed DEPOSIT/BANK data

## Success Criteria

- Row-level + total-level net VND correct.
- DEPOSIT rows show fee = 0.
- Excel export opens cleanly with new columns.

## Risks

- Column width overflow on narrow screens — may need horizontal scroll.
