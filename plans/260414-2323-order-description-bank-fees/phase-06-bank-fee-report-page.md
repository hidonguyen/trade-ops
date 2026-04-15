# Phase 06 — `/reports/bank-fees` page + Excel export

## Overview
- Priority: High
- Status: pending
- Depends on: Phase 02

Dedicated page listing all bank-fee transactions with filters, totals, Excel export.

## Requirements

### Page (`app/(dashboard)/reports/bank-fees/page.tsx`)

- Filters: date range (`from`, `to`), Business Unit, Currency, Party (optional).
- Table columns: Date, BU, Party, Order (if tied), Tx type, Amount (original + VND), **Bank fee (original + VND)**, Bank Reference, Notes.
- Totals: sum fee VND (grand total) + breakdown by currency.
- Pagination (reuse `components/shared/pagination.tsx`).
- Excel export button → calls API with `?format=xlsx`.

### Reports landing page (`app/(dashboard)/reports/page.tsx`)

- Add new card/link: "Phí ngân hàng" → `/reports/bank-fees`.

### API (from Phase 02)

- `GET /api/reports/bank-fees` — JSON.
- `GET /api/reports/bank-fees?format=xlsx` — Excel download (or separate `/export` subpath, following existing report export convention; grep to confirm).

## Files

- Create: `app/(dashboard)/reports/bank-fees/page.tsx`
- Modify: `app/(dashboard)/reports/page.tsx` (add link)
- Modify/create: Excel export helper (reuse existing exceljs pattern from cashflow)

## Steps

1. Confirm existing Excel export convention (separate endpoint vs query param).
2. Build page with filter bar + data table + totals + pagination.
3. Implement Excel export matching convention.
4. Add link on reports landing page.
5. RBAC: same as `/reports` (viewer+).

## Todo

- [ ] Create bank-fees page with filters + table
- [ ] Implement pagination + totals by currency
- [ ] Excel export working
- [ ] Link on `/reports` landing
- [ ] RBAC respected
- [ ] Visual test with seed data

## Success Criteria

- Only transactions with `bankFeeOriginal > 0` appear.
- Totals correct across currencies.
- Excel matches on-screen data.

## Security

- Scope results by user's accessible BUs (follow existing report scoping).

## Risks

- Parity between JSON and Excel — share a single query builder.
