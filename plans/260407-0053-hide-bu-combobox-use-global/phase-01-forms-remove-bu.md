---
phase: 1
status: planned
priority: high
---

# Phase 1: Forms — Remove BU Combobox

## Strategy
- Remove BU combobox JSX from each form
- Remove `businessUnits` state and fetch (unless used for other purposes)
- Keep `businessUnitId` in form data — auto-set from `getDefaultBu()` (already done in previous plan)
- Remove BU validation errors display (field is auto-filled, can't be empty if global BU is set)
- **Keep validation** — if no global BU set, show error

## Files

### `components/order-form.tsx`
- Remove `businessUnits` state + BU fetch from `loadData()`
- Remove BU combobox JSX (~lines 170-176)
- Keep `businessUnitId` in `OrderFormData` and `defaultForm`
- Already uses `getDefaultBu()` for initial value

### `components/party-form.tsx`
- Remove `businessUnits` state + BU fetch
- Remove BU combobox JSX (~lines 111-118)
- Keep `businessUnitId` in `PartyFormData` and `EMPTY`

### `components/transaction-form.tsx`
- Remove `businessUnits` state + BU fetch
- Remove BU combobox JSX (~lines 230-236)
- **KEEP** the `useEffect` that fetches parties filtered by `form.businessUnitId` (line 110-118) — this still needs the BU value
- Remove BU from the BU options list for combobox

### `components/deposit-form.tsx`
- Remove `businessUnits` state + BU fetch
- Remove BU combobox JSX (~lines 103-109)
- Keep `businessUnitId` state — already uses `getDefaultBu()`

## Todo
- [ ] order-form: remove BU combobox UI + state/fetch
- [ ] party-form: remove BU combobox UI + state/fetch
- [ ] transaction-form: remove BU combobox UI + state/fetch (keep party filter)
- [ ] deposit-form: remove BU combobox UI + state/fetch
