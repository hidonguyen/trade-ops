# Phase 04 — UI: BU-scoped Assignment + Selector

**Effort:** 6h | **Status:** planned | **Depends on:** Phase 03

## Components

### 1. Settings → User Detail
Replace flat role checkbox list with a **role × BU matrix**:
- Rows: roles (ACCOUNTANT_SALE, ACCOUNTANT_PURCHASE, ACCOUNTANT_CASHFLOW, VIEWER)
- Cols: active BUs (TK, NT, ...)
- Special row: ADMIN (single global checkbox, no BU column)
- Save → diff vs current → `POST /api/settings/users/:id/roles` with `[{role, businessUnitId|null, op}]`

### 2. Header BU Switcher (optional but recommended)
- Dropdown: list of BUs the user has access to (any role).
- Persists selection in `localStorage` + cookie.
- Pages with BU-scoped lists default-filter to selected BU.
- Auto-hidden if user has access to only 1 BU.

### 3. Permission-aware UI gating
- `useRoles()` hook returns `RoleAssignment[]`.
- Existing button/menu gating updated to pass current page's `businessUnitId`.

## Todo
- [ ] User-edit matrix component
- [ ] PUT endpoint: replace user's BU-scoped assignments
- [ ] Header BU switcher
- [ ] Update `useRoles()` to expose `RoleAssignment[]`
- [ ] Sweep gated buttons (orders/parties/transactions/deposits) to pass BU

## Success
- ADMIN can grant ACCOUNTANT_SALE only on TK to a user; user cannot see NT orders' edit buttons.
