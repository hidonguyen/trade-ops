---
title: "RBAC — per Business Unit scoping"
description: "Scope user roles to specific Business Units (TK/NT). User can hold different roles per BU; ADMIN remains global."
status: completed
priority: P1
effort: 28h (~3.5 dev-days)
branch: main
tags: [rbac, auth, business-unit, schema-migration]
created: 2026-05-07
blockedBy: []
blocks: []
---

# RBAC — Per Business Unit Scoping

## Context
- Existing global RBAC: `plans/260505-1659-rbac-audit-and-enforcement/`, `plans/260505-1806-rbac-finish-remaining/` (both completed).
- Current state: `UserRoleAssignment(userId, role)` — global, applies to all BUs.
- Target: a user can be e.g. `ACCOUNTANT_SALE` in `TK` only, and `VIEWER` in `NT`. ADMIN stays global.
- All major entities (`Order`, `Party`, `Transaction`, `Deposit`) already carry `businessUnitId` — enforcement point exists.

## Goal
Every read/write path resolves the target `businessUnitId`, then checks `(role, BU)` against the matrix instead of just `role`.

## Phases
| # | Phase | Status | Effort | Files |
|---|-------|--------|--------|-------|
| 1 | [Schema + migration](./phase-01-schema-migration.md) | completed | 4h | `prisma/schema.prisma`, migration SQL, seed |
| 2 | [RBAC helper + JWT/session](./phase-02-rbac-helper-jwt.md) | completed | 5h | `lib/rbac.ts`, `lib/auth.ts`, `types/*` |
| 3 | [API enforcement (all routes)](./phase-03-api-enforcement.md) | completed | 8h | `app/api/**`, `lib/api-helpers.ts` |
| 4 | [UI: BU-scoped role assignment + selector](./phase-04-ui-assignment-selector.md) | completed | 6h | `app/(dashboard)/settings/users/**`, header BU switcher |
| 5 | [List filtering by BU access](./phase-05-list-filtering.md) | completed | 3h | reports / list endpoints |
| 6 | [Tests + docs](./phase-06-tests-docs.md) | completed | 2h | tests + `docs/system-architecture.md` |

## Status
All 6 phases implemented 2026-05-18. Type-check clean, 14 RBAC unit tests pass.
Migration `20260518095200_rbac_per_business_unit` is hand-written and **unapplied** —
the RDS instance was unreachable during implementation. Apply with
`prisma migrate deploy` once the DB is reachable.

## Dependencies
1 → 2 → 3 → 4. 5 parallel to 4. 6 last.

## Migration Strategy
- Add nullable `businessUnitId` to `UserRoleAssignment`.
- `null` = global (ADMIN only by convention).
- Backfill: for every existing non-ADMIN assignment, duplicate row per active BU (preserves current behavior). ADMIN rows keep `null`.
- Unique key changes: `(userId, role, businessUnitId)`.

## Success Criteria
- Non-admin user with role only in TK gets 403 on any NT-scoped write/read of restricted module.
- Order/transaction/deposit/party lists return only rows from BUs the user has any access to.
- Settings UI lets ADMIN assign `(role, BU)` triples per user.
- Existing users keep current effective access after migration (no regressions).

## Rollback
- Migration is additive (new column + duplicated rows). Down-migration drops column + dedupes — script included.

## Cost Estimate (Customer Quote)
See [cost-estimate.md](./cost-estimate.md).

## Risk
- 101+ callsites of `checkAccess` / role reading — risk of missing one. Mitigation: codemod + grep audit in phase 3.
- Token bloat: roles array grows from N → N×BU. Mitigation: compact format `${role}:${buId}`.
- UI complexity for assignment matrix. Mitigation: simple per-user table (rows=role, cols=BU, checkboxes).
