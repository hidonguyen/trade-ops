---
title: "Phase 3: Order Date Filtering"
status: completed
priority: P2
effort: 1.5h
blockedBy: [phase-01]
completed_date: 2026-04-04
---

# Phase 3: Order Date Filtering

## Overview

Add date range filtering (from/to) to the orders list page, including API support and filter bar UI.

## Files to Modify

| File | Change |
|------|--------|
| `app/api/orders/route.ts` | Add `dateFrom`/`dateTo` query params to WHERE clause |
| `app/(dashboard)/orders/page.tsx` | Add dateFrom/dateTo filters to FilterConfig |
| `components/shared/filter-bar.tsx` | Add `"date-range"` filter type with from/to DatePicker pair |

## Implementation Steps

### 1. API: `app/api/orders/route.ts`

Add after existing query param parsing (line ~24):

```ts
const dateFrom = searchParams.get("dateFrom");
const dateTo = searchParams.get("dateTo");
```

Add to `where` object (line ~44):

```ts
...(dateFrom && { orderDate: { gte: new Date(dateFrom) } }),
...(dateTo && { orderDate: { ...((dateFrom ? { gte: new Date(dateFrom) } : {})), lte: new Date(dateTo) } }),
```

Simplified: merge into single `orderDate` filter when both present.

### 2. FilterBar: `components/shared/filter-bar.tsx`

Add new filter type `"date-range"`:

```ts
export interface FilterConfig {
  key: string;
  label: string;
  type: "select" | "search" | "date" | "date-range";
  options?: FilterOption[];
  placeholder?: string;
  // date-range uses `${key}From` and `${key}To` as filter keys
}
```

Render two DatePicker components side-by-side for `"date-range"` type:
- From picker: calls `onFilterChange(`${filter.key}From`, value)`
- To picker: calls `onFilterChange(`${filter.key}To`, value)`
- Label between: "→" or "đến"

### 3. Orders Page: `app/(dashboard)/orders/page.tsx`

Add to filterConfigs array:

```ts
{ key: "date", label: "Ngày đặt", type: "date-range" },
```

Update fetchOrders to pass dateFrom/dateTo:

```ts
...(filters.dateFrom ? { dateFrom: filters.dateFrom } : {}),
...(filters.dateTo ? { dateTo: filters.dateTo } : {}),
```

## Todo List

- [x] Add dateFrom/dateTo params to orders API
- [x] Add date-range type to FilterBar
- [x] Add date filter to orders page
- [x] Test: filter orders by date range
- [x] Run build to verify

## Success Criteria

- [x] Orders API accepts `dateFrom` and `dateTo` query params
- [x] Orders page shows date range pickers in filter bar
- [x] Filtering by date range returns correct results
- [x] Clearing dates shows all orders
- [x] No compile errors

## Completion Summary

Phase 3 successfully implemented date range filtering for orders:

1. **API Enhancement** (`app/api/orders/route.ts`): Added dateFrom/dateTo query parameter validation and filtering. WHERE clause properly handles single-date (from only, to only) and range (both from and to) scenarios. Date parameters validated to ensure proper ISO format.

2. **FilterBar Component** (`components/shared/filter-bar.tsx`): Added new "date-range" filter type supporting dual DatePicker controls (from/to). Filters stored as `${key}From` and `${key}To` in filter state.

3. **Orders Page** (`app/(dashboard)/orders/page.tsx`): Added date range filter config with label "Ngày đặt". Filter state properly passed to API fetch with correct parameter names.

Tested end-to-end: date range filtering returns correct subsets of orders. Clearing dates shows all orders. No compile errors.
