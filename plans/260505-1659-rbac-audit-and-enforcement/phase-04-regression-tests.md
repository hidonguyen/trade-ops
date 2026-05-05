# Phase 4 — Regression tests

Minimal coverage to lock matrix → behavior parity.

## Unit tests
`lib/__tests__/rbac.test.ts`:
- For each role × module × action in matrix, assert `checkAccess` returns expected boolean.
- Edge: empty roles array → false. Unknown role → false. Multiple roles → most-permissive wins.

## Integration tests (one per write-action × role denial)
`__tests__/api/transactions.rbac.test.ts`:
- ACCOUNTANT_SALE POST `/api/transactions` with `type=PAYMENT` → 403.
- ACCOUNTANT_SALE PUT `/api/transactions/[id]` on a PAYMENT tx → 403.
- ACCOUNTANT_SALE DELETE same → 403.
- Same role POST with `type=RECEIPT` → 2xx.
- ACCOUNTANT_PURCHASE POST `type=RECEIPT` → 403.

`__tests__/api/orders.rbac.test.ts`:
- ACCOUNTANT_SALE POST `/api/orders` with `type=PURCHASE` → 403.
- GET `/api/orders?type=PURCHASE` → 2xx (read allowed).

`__tests__/api/admin.rbac.test.ts`:
- Non-ADMIN GET `/api/admin/*` → 403.

## Mocking
Reuse existing test auth helper if present; otherwise stub `auth()` to return synthetic session.

## Todo
- [ ] Write `rbac.test.ts` (matrix exhaustive)
- [ ] Write transaction integration tests
- [ ] Write orders + admin integration tests
- [ ] CI green
