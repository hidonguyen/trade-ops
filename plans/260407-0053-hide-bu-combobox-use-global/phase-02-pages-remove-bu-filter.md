---
phase: 2
status: planned
priority: high
---

# Phase 2: Pages — Remove BU Filter, Auto-Inject Global BU

## Strategy
- Remove BU filter from `FilterBar` configs
- Remove `businessUnits` state + BU fetch from pages
- Auto-inject `getDefaultBu()` into API fetch params
- Dashboard: remove local BU dropdown, use global BU directly

## Files

### `app/(dashboard)/orders/page.tsx`
- Remove BU filter config from `filterConfigs` array
- Remove `businessUnits` state + fetch
- In `fetchOrders()`: always add `businessUnitId: getDefaultBu()` to params

### `app/(dashboard)/parties/page.tsx`
- Remove BU filter config
- Remove `businessUnits` state + fetch
- In `fetchParties()`: always add `businessUnitId: getDefaultBu()` to params

### `app/(dashboard)/transactions/page.tsx`
- Remove BU filter config
- Remove `businessUnits` state + fetch
- In fetch: always add `businessUnitId: getDefaultBu()` to params

### `app/(dashboard)/cashflow/page.tsx`
- Remove BU filter config
- Remove `businessUnits` state + fetch
- In both fetch calls: always add `businessUnitId: getDefaultBu()`

### `app/(dashboard)/reports/page.tsx`
- Remove BU filter config
- Remove `businessUnits` state + fetch
- Auto-inject BU in summary fetch
- Remove BU from `filters` state, use `getDefaultBu()` directly

### `app/(dashboard)/page.tsx` (Dashboard)
- Remove local BU `Select` dropdown
- Remove `selectedBuId` state + BU fetch
- Use `getDefaultBu()` directly in dashboard API call

## Todo
- [ ] orders/page.tsx: remove BU filter, auto-inject
- [ ] parties/page.tsx: remove BU filter, auto-inject
- [ ] transactions/page.tsx: remove BU filter, auto-inject
- [ ] cashflow/page.tsx: remove BU filter, auto-inject
- [ ] reports/page.tsx: remove BU filter, auto-inject
- [ ] page.tsx (dashboard): remove BU dropdown, use global
