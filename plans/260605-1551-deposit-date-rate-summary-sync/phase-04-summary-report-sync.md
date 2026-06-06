---
phase: 4
title: Summary Report Sync
status: completed
priority: P1
effort: 2.5h
dependencies:
  - 2
---

# Phase 4: Summary Report Sync

## Overview

Sync the summary report ("Báo cáo tổng hợp") with the new deposit fields: filter/sort deposit rows by `depositDate` (not `createdAt`), carry `exchangeRate` + a computed VND amount through the API, render a **Tỉ giá** and **Quy đổi VND** column on the web table, and replace the hardcoded `vndAmount: 0` in the Excel export with `amountOriginal × exchangeRate`.

## Requirements

- Functional:
  - Deposit rows in the report are bounded/sorted by `depositDate` (same date-range boundaries on web data API AND Excel export).
  - Web standalone table shows `Tỉ giá` and `Quy đổi VND` columns. **Only deposit rows are populated**; transaction/bank-fee/refund rows render "—" (see Architecture note — bank-fee rows use a different amount basis, so reusing `t.amountVnd` for them would be wrong; populating all rows is scope creep the user did not ask for).
  - Excel export deposit rows show `vndAmount = round(amountOriginal × exchangeRate)`.
- Non-functional: keep `Decimal` math (no float, always `.toString()` before `new Decimal(...)`); preserve existing row routing (customer → Thu khác, supplier → Chi khác).

## Architecture

Three surfaces, all driven off the same new data.

**0. PREREQUISITE — fix the date-range boundary timezone bug (both surfaces).**
The summary data API builds its range with `toDate.setHours(23,59,59,999)` which uses **server-local** time, while `dateField` stores `depositDate` at **UTC midnight** (`new Date("YYYY-MM-DD")`). Switching the deposit filter from `createdAt` (a real `now()` timestamp) to `depositDate` (UTC midnight) exposes an off-by-one: a deposit dated on a period edge can silently fall out of the report depending on server TZ. The orders list route already solves this correctly with explicit UTC (`app/api/orders/route.ts:65`). Before changing the deposit filter, normalize BOTH the data API (`summary/route.ts:49-51`) and the Excel export (`export/route.ts:42-44`) to construct identical UTC boundaries:
```ts
const fromDate = new Date(`${dateFrom}T00:00:00.000Z`);
const toDate   = new Date(`${dateTo}T23:59:59.999Z`);
```
This also stabilizes all other rows already filtered by that range — verify no regression to existing transaction/order filtering (same range object, now UTC-explicit).

1. **Data API** (`app/api/reports/summary/route.ts`):
   - `StandaloneRow` type (lines 15-29): add `exchangeRate: string | null` and `amountVnd: string | null`.
   - Deposit query (lines 183-194): change the filter to `depositDate: { gte: fromDate, lte: toDate }` (was `createdAt`) and `orderBy: { depositDate: "asc" }`. The query uses `include` (not a restrictive `select`), so the new `depositDate`/`exchangeRate` scalars are returned automatically — **no select change needed**.
   - Deposit row build (lines 231-249): `date: d.depositDate.toISOString()`, `exchangeRate: d.exchangeRate.toString()`, `amountVnd: new Decimal(d.amountOriginal.toString()).times(d.exchangeRate.toString()).toDecimalPlaces(0).toString()` (note the `.toString()` on the Prisma `Decimal` operands — matches the codebase convention, e.g. `export/route.ts:256`).
   - **Non-deposit standalone rows: set `exchangeRate: null, amountVnd: null`** in `buildStandaloneRows` (line 211), `feeRows` (line 252), and `buildRefundRows` (line 275). Do NOT add a `select` to the `receipts`/`payments` queries — they use `include`, so scalars already return; converting to `select` would silently drop the fields the row builders read (`amountOriginal`, `paymentMethod`, `bankReference`, `notes`). Bank-fee rows in particular use `bankFeeOriginal` as their amount, so reusing `t.amountVnd` for them would be a wrong number — hence null/"—". (Populating only deposit VND is exactly the "đồng bộ hiển thị" the user asked for: deposit section synced to the report.)

2. **Web page** (`app/(dashboard)/reports/summary/page.tsx`):
   - Mirror the `StandaloneRow` interface (lines 30-47) with `exchangeRate: string | null` + `amountVnd: string | null`.
   - Add two columns to `STANDALONE_COLUMNS` (lines 129-195) after "Số tiền"/"Tiền tệ": `Tỉ giá` (render rate, "—" when null/1) and `Quy đổi VND` (render `amountVnd` with thousands sep, "—" when null).
   - Update CSV export column list (`exportToCsv`, line 199) so the new columns are included.

3. **Excel export** (`app/api/reports/summary/export/route.ts`):
   - Deposit query at `export/route.ts:234-245` uses `include` → new scalars return automatically (no `select` change; adding a top-level `select` would conflict with the existing `include` of `party`/`currency` and break `dep.party.name`/`dep.currency.code`). Change exactly two lines in the query: the `where` filter `createdAt` → `depositDate` (line 238) and `orderBy` `createdAt` → `depositDate` (line 244).
   - Deposit row mapping (lines 294-312): set `transactionDate: dep.depositDate` (replace `dep.createdAt` at line 297) and `vndAmount: new Decimal(dep.amountOriginal.toString()).times(dep.exchangeRate.toString()).toDecimalPlaces(0).toNumber()` (replace `vndAmount: 0` at line 304).
   - **Branch polarity caution:** the export routes deposits via `if (dep.party.type === "CUSTOMER") otherReceiptRows… else otherPaymentRows…` (line 307), which is the **mirror image** of the data API's `if (d.party.type === "SUPPLIER") … else …` (`route.ts:247`). Both are correct as written — only change `transactionDate` + `vndAmount`; do NOT touch the routing conditional or copy the data-API branch.

## Related Code Files

- Modify: `app/api/reports/summary/route.ts` (UTC date-range fix ~lines 49-51; StandaloneRow type; deposit query filter/orderBy; deposit row build VND; null VND on non-deposit rows)
- Modify: `app/(dashboard)/reports/summary/page.tsx` (StandaloneRow interface, STANDALONE_COLUMNS, CSV export)
- Modify: `app/api/reports/summary/export/route.ts` (UTC date-range fix ~lines 42-44; deposit query `where`/`orderBy` lines 238/244; deposit row date+VND mapping lines 297/304)

## Implementation Steps

1. **First** apply the UTC date-range normalization (Architecture §0) in BOTH `summary/route.ts:49-51` and `export/route.ts:42-44` — identical boundaries.
2. Data API: extend `StandaloneRow`; switch deposit filter/orderBy to `depositDate`; compute `amountVnd` (with `.toString()` operands) for deposit rows; set `exchangeRate`/`amountVnd` to `null` on transaction/fee/refund rows. No `select` changes (queries use `include`).
3. Web page: add the two columns + CSV inclusion; render "—" for null/unity rate.
4. Excel export: change deposit `where`/`orderBy` (lines 238/244) to `depositDate`; set `transactionDate: dep.depositDate` (line 297); replace `vndAmount: 0` (line 304) with the computed product. Do not alter the customer/supplier routing conditional.
5. Re-check the cache-tag invalidation already fires on deposit create/update/delete (`TAG.reportsByBu`) so the cached web report refreshes — confirm only. Note the export route is uncached (live query); ensure its UTC boundaries match the data API so cached web + live Excel agree.
6. `npm run type-check`; open the summary report for a BU with deposits, verify date/rate/VND columns; edit a deposit's `depositDate` across a month boundary and confirm web + Excel agree on which period it lands in.

## Success Criteria

- [ ] Both surfaces use identical UTC date-range boundaries (`T00:00:00.000Z` / `T23:59:59.999Z`)
- [ ] Deposit rows filter + sort by `depositDate` in both data API and Excel export
- [ ] Web table shows `Tỉ giá` + `Quy đổi VND`; deposit rows show `amount × rate`, non-deposit rows show "—"
- [ ] Excel deposit rows show computed VND (no longer `0`) and use `depositDate`; customer/supplier routing unchanged
- [ ] CSV export includes the new columns
- [ ] A deposit edited across a month boundary appears in the same period on web AND Excel
- [ ] `npm run type-check` passes; report renders for a BU with deposits

## Risk Assessment

- Risk: TZ-dependent off-by-one at period edges → mitigated by the UTC normalization in §0 (the core fix; without it the `createdAt`→`depositDate` switch silently drops edge deposits).
- Risk: changing the deposit filter from `createdAt` → `depositDate` shifts which deposits appear in a period → intended per user decision; call out in the changelog.
- Risk: bank-fee/refund rows have no meaningful single rate → render "—" (null); do NOT reuse `t.amountVnd` for fee rows (their amount basis is `bankFeeOriginal`).
- Risk: web (cached) vs Excel (live) disagreement → mitigated by identical UTC boundaries + existing `TAG.reportsByBu` invalidation on deposit writes.
- Risk: VND rounding mismatch between web and Excel → use the same `toDecimalPlaces(0)` rule in both.

## Security Considerations

Read-only report surfaces; RBAC already enforced on the summary endpoints. No change.

## Next Steps

After Phases 3+4: run `/ck:test`, then `/ck:code-review`. Update `docs/project-changelog.md` (deposit date/rate + report VND for deposits). Optional follow-up: extend the Deposit Tracking report (`/api/reports/deposits`) with rate/VND if desired (out of scope here).
