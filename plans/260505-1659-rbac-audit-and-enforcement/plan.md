---
title: "RBAC audit + enforcement to match defined matrix"
description: "ACCOUNTANT_SALE currently sees Settings, edits PAYMENT, sees all reports — diverges from matrix in lib/api-helpers.ts. Audit every API route + UI gating, fix divergences, add minimal regression test."
status: completed
priority: P1
effort: 6h
branch: main
tags: [rbac, security, audit]
created: 2026-05-05
blockedBy: []
blocks: []
---

# RBAC Audit & Enforcement

## Source of Truth
`lib/api-helpers.ts` `permissionMatrix`:

| Role | SALE | PURCHASE | CUSTOMER | SUPPLIER | RECEIPT | PAYMENT | CASHFLOW | DASHBOARD | ADMIN |
|------|------|----------|----------|----------|---------|---------|----------|-----------|-------|
| ADMIN | FULL | FULL | FULL | FULL | FULL | FULL | FULL | FULL | FULL |
| ACCOUNTANT_SALE | FULL | GET | FULL | GET | FULL | DENY | FULL | FULL | DENY |
| ACCOUNTANT_PURCHASE | GET | FULL | GET | FULL | DENY | FULL | FULL | FULL | DENY |
| ACCOUNTANT_CASHFLOW | GET | GET | GET | GET | FULL | FULL | FULL | FULL | DENY |
| VIEWER | GET (everything) | DASHBOARD FULL | ADMIN DENY |

User confirmed: **don't change matrix; align reality to matrix.**

## Reported Symptoms (ACCOUNTANT_SALE)
1. Sees menu **Cài đặt** — sidebar adminOnly should hide it.
2. Sees **Đơn mua / NCC** — by matrix GET (read-only) → menu visible OK, but verify no edit/delete buttons.
3. **Edits PAYMENT** transactions — matrix DENY → bug, must block.
4. Sees **all reports** — DASHBOARD FULL for everyone → by matrix OK, but flag for review.

## Phases
| # | Phase | Status | Output |
|---|-------|--------|--------|
| 1 | [Audit — map endpoints + UI vs matrix](./phase-01-audit.md) | pending | Divergence report |
| 2 | [Fix endpoint gaps](./phase-02-fix-endpoints.md) | pending | API checkAccess corrections + write-action guards |
| 3 | [Fix UI gating](./phase-03-fix-ui-gating.md) | pending | Sidebar + action button hides + form disables |
| 4 | [Regression tests](./phase-04-regression-tests.md) | pending | Per-role smoke tests for write endpoints |

## Approach
- **Phase 1 first** produces a divergence report. Don't fix blindly.
- Iteration order: bugs blocking real users (edit PAYMENT, Settings menu) → cosmetic gating → tests.

## Key Files
- `lib/api-helpers.ts` — matrix + `checkAccess`
- `lib/auth.ts` — session role injection (verify roles array)
- 32 `app/api/**/route.ts` files — 50 `checkAccess()` call sites
- `components/layout/sidebar.tsx` — `adminOnly` group filter (currently only on Settings)
- All edit/delete action buttons in pages + form mount conditions

## Investigation Hypotheses (to validate Phase 1)
A. Settings menu visible → either `userRoles` actually contains "ADMIN" alongside ACCOUNTANT_SALE, or `adminOnly` check is bypassed.
B. PAYMENT edit allowed → transaction edit endpoint uses wrong module (likely `RECEIPT` instead of `PAYMENT` based on tx.type, or no module check).
C. Order tx delete/edit endpoints may not branch by `paymentType` (PAYMENT vs RECEIPT).

## Success Criteria
- For each role × module × action: behavior matches matrix.
- ACCOUNTANT_SALE: cannot create/edit/delete any PAYMENT tx (server returns 403); UI hides the buttons.
- Settings menu hidden for non-ADMIN; admin-only API routes return 403 for non-ADMIN.
- Cross-role visibility (GET) preserved per matrix.
- At least 1 regression test per write-action / per role.

## Rollback
Per-file revert. Matrix unchanged. No DB schema change.

## Open Questions
- Are roles seeded correctly? (test user might have ADMIN role in DB) — Phase 1 verifies by querying user.roles.
- Does any endpoint need finer-grained module pick (e.g. transaction edit needs to check PAYMENT vs RECEIPT based on tx.type, not the request method)? — Phase 1 lists.
