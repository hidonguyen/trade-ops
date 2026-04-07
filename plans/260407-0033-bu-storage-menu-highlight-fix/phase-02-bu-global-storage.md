---
phase: 2
status: planned
priority: high
---

# Phase 2: BU Global Storage

## Problem
Header BU selector value is lost on page reload. Forms don't use it as default.

## Solution

Use `localStorage` key `trade-ops:selected-bu` to persist the selected BU ID.

### A. Header: Persist BU selection
In `header.tsx`:
- On mount: read saved BU ID from localStorage, use as initial value (fallback to first BU from API)
- On change: save to localStorage

```tsx
// On mount after fetching BUs
const savedBu = localStorage.getItem("trade-ops:selected-bu");
const defaultBu = json.data.find((bu) => bu.id === savedBu) ? savedBu : json.data[0].id;
setSelectedBu(defaultBu);

// On change
onValueChange={(val) => {
  if (val) {
    setSelectedBu(val);
    localStorage.setItem("trade-ops:selected-bu", val);
  }
}}
```

### B. Forms: Read default BU from localStorage
In `order-form.tsx`, `party-form.tsx`, `transaction-form.tsx`, `deposit-form.tsx`:
- When initializing form state, read `trade-ops:selected-bu` from localStorage
- Use as default `businessUnitId` if available

## Files to Modify
- `components/layout/header.tsx` — persist + restore BU
- `components/order-form.tsx` — default BU from storage
- `components/party-form.tsx` — default BU from storage
- `components/transaction-form.tsx` — default BU from storage
- `components/deposit-form.tsx` — default BU from storage

## Todo
- [ ] Header: save selected BU to localStorage on change
- [ ] Header: restore saved BU on mount
- [ ] Forms: read default BU from localStorage on init
- [ ] Verify BU persists across page reloads
