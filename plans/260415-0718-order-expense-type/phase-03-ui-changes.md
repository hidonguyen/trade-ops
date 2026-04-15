# Phase 03 — UI: form + list column + filter + summary report

## Overview
- Priority: High
- Status: pending
- Depends on: Phase 01

## components/order-form.tsx

- Fetch active ExpenseType list on mount (new `/api/expense-types` — already exists per codebase).
- Add Combobox field "Loại chi phí", visible only when `form.type === "PURCHASE"`.
- Optional (no required marker).
- If type switches SALE → PURCHASE, keep current value empty. If PURCHASE → SALE, clear the field before submit.
- Submit payload includes `expenseTypeId` when non-empty AND type=PURCHASE.

## app/(dashboard)/orders/[id]/order-info-card.tsx

- Add dt/dd for `expenseType.name` only when `order.type === "PURCHASE"` AND `order.expenseType` is present.

## app/(dashboard)/orders/page.tsx

- Show "Loại chi phí" column only when `urlType === "PURCHASE"` (dynamic column array).
- Filter: add ExpenseType select to `filterConfigs` when `urlType === "PURCHASE"`.
- Wire filter to `?expenseTypeId=` query param on API call.

## New: app/(dashboard)/reports/expense-type-summary — inline in existing /reports page as new tab

- Add new tab `"expenseType"` with label "Theo Loại chi phí".
- Fetch `/api/reports/expense-type-summary` with active date range.
- Render: per-expense-type card/row with count + per-currency totals.
- CSV export: reuse existing pattern.

## Files

- Modify: `components/order-form.tsx`
- Modify: `app/(dashboard)/orders/[id]/order-info-card.tsx`
- Modify: `app/(dashboard)/orders/page.tsx`
- Modify: `app/(dashboard)/reports/page.tsx`

## Todo

- [ ] Fetch + cache expense types in order form
- [ ] Conditional combobox on PURCHASE
- [ ] Clear field on SALE switch
- [ ] Detail card shows expense type when present
- [ ] List column conditional on PURCHASE
- [ ] Filter conditional on PURCHASE
- [ ] Reports page: new tab with expense-type summary
- [ ] Manual test matrix:
  - [ ] Create PURCHASE with expense type
  - [ ] Create PURCHASE without expense type
  - [ ] Switch form SALE↔PURCHASE, field appears/clears
  - [ ] List filter by expense type works
  - [ ] Summary report shows totals + "Chưa phân loại" bucket

## Success Criteria

- Purchase order detail + list show expense type when set.
- SALE order form has no ExpenseType field.
- Summary report shows correct aggregates.

## Risks

- Hitting deactivated ExpenseType on existing orders: display name (still stored in DB), don't break.
