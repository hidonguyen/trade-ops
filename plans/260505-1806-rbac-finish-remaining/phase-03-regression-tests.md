# Phase 3 — Regression tests

## Setup
Check existing test config: `package.json` test scripts, `vitest.config.ts` or `jest.config.js`. Reuse existing framework.

## Unit tests
`lib/__tests__/rbac.test.ts`:
- For each (role × module × action) in matrix, assert checkAccess returns expected boolean.
- Edge cases: empty roles, unknown role, multiple roles (most-permissive wins), GET-only role + non-GET action.

## Skip integration tests if framework absent
Integration tests for API routes need NextAuth mocking + Prisma test DB. Heavy lift. Defer unless framework already exists.

If `__tests__/` or `tests/` already has API integration setup → add:
- `__tests__/api/orders-tx.rbac.test.ts`: ACCOUNTANT_SALE PATCH PAYMENT tx on SALE order → 403 (verifies P2 fix in prior plan).

## Todo
- [ ] Detect existing test framework
- [ ] Write rbac.test.ts (matrix + edge)
- [ ] If integration setup exists → add 1 test verifying P2 fix
- [ ] Run `npm test` (or whichever) → all green
