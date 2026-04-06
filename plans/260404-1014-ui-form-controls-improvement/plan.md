---
title: "UI Form Controls Improvement"
description: "Searchable comboboxes, date picker, formatted number inputs, and order date filtering"
status: completed
priority: P2
effort: 8h
branch: feat/ui-form-controls
tags: [ui, ux, forms, combobox, datepicker, number-format]
created: 2026-04-04
completed: 2026-04-04
---

# UI Form Controls Improvement

## Problem

1. Select dropdowns have no type-to-search — slow for long lists (parties, business units)
2. Native `<input type="date">` is ugly and inconsistent across browsers
3. Number inputs show raw digits — no thousands separators or decimal formatting
4. Orders page has no date filtering

## Phase Summary

| # | Phase | Status | File | Blocks |
|---|-------|--------|------|--------|
| 1 | Shared UI Components | Completed | [phase-01](phase-01-shared-ui-components.md) | 2, 3 |
| 2 | Apply to All Forms | Completed | [phase-02-apply-to-forms.md](phase-02-apply-to-forms.md) | — |
| 3 | Order Date Filtering | Completed | [phase-03-order-date-filtering.md](phase-03-order-date-filtering.md) | — |

## Dependency Graph

```
Phase 1 (Combobox + DatePicker + NumberInput) ─── GATE
  ├──> Phase 2 (Apply to all forms)
  └──> Phase 3 (Order date filtering — API + UI)
```

## Affected Files

### New Components (Phase 1)
- `components/ui/combobox.tsx` — searchable select with Base UI Popover
- `components/ui/date-picker.tsx` — calendar-based date picker
- `components/ui/number-input.tsx` — formatted number input with thousands separators

### Modified Forms (Phase 2)
- `components/order-form.tsx` — party, BU, currency → combobox; amount → number-input; date → date-picker
- `components/transaction-form.tsx` — same pattern
- `components/payment-form.tsx` — same pattern
- `components/deposit-form.tsx` — currency, BU → combobox; amount → number-input
- `components/party-form.tsx` — BU → combobox

### Date Filtering (Phase 3)
- `app/api/orders/route.ts` — add dateFrom/dateTo query params
- `app/(dashboard)/orders/page.tsx` — add date range filters
- `components/shared/filter-bar.tsx` — add "date-range" filter type

## Key Decisions

- **Combobox**: Build on Base UI Popover + native input for filtering (no cmdk dependency)
- **Date Picker**: Use `react-day-picker` + `date-fns` — proven, accessible, small bundle
- **Number Input**: Custom component — format on blur, parse on focus, store raw value
- **Locale**: Vietnamese (vi-VN) for date display and number formatting
