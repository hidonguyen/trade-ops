---
title: "RBAC — finish remaining (UI gating + JWT refresh + tests)"
description: "Wrap up RBAC: gate orders/parties/settings UI buttons, JWT role refresh on next request, regression tests for matrix + key write endpoints."
status: completed
priority: P2
effort: 4h
branch: main
tags: [rbac, ui, auth, tests]
created: 2026-05-05
blockedBy: []
blocks: []
---

# RBAC — Finish Remaining

## Context
Builds on `plans/260505-1659-rbac-audit-and-enforcement/` (completed). Backend already enforced + tx page UI gated + roles provider in place. This finishes the leftovers.

## Phases
| # | Phase | Status | Files |
|---|-------|--------|-------|
| 1 | [JWT auto-refresh roles](./phase-01-jwt-refresh-roles.md) | completed | `lib/auth.ts` |
| 2 | [UI gating: orders + parties + settings](./phase-02-ui-gating-pages.md) | completed | `app/(dashboard)/orders/**`, `app/(dashboard)/parties/**`, `app/(dashboard)/settings/**` |
| 3 | [Regression tests — matrix + key endpoints](./phase-03-regression-tests.md) | deferred (no test framework configured) | — |

## Dependencies
Phase 1 independent. Phase 2 independent. Phase 3 last.

## Success Criteria
- After role change in DB, next request fetches fresh roles (no need to logout) — Phase 1.
- Orders/parties/settings buttons hidden per matrix per row context — Phase 2.
- Test suite covers matrix exhaustively + 1 integration per role × forbidden write — Phase 3.

## Rollback
Per-file revert. No schema change.
