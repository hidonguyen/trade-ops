---
title: "Remove Party.type BOTH"
description: "Drop BOTH from Party.type; only CUSTOMER or SUPPLIER remain."
status: completed
priority: P1
effort: 4h
branch: main
tags: [refactor, schema, rbac, ui]
created: 2026-05-04
completed: 2026-05-04
blocks: [260504-2224-summary-report-deposits-and-fees]
---

# Remove `Party.type === "BOTH"`

## Goal
Eliminate the `BOTH` case from Party.type. Backfill existing data, simplify RBAC/filter expansions, prune UI branches.

## Phases

| # | Phase | File | Status | Notes |
|---|-------|------|--------|-------|
| 1 | Data migration (backfill BOTH → CUSTOMER/SUPPLIER) | [phase-01-data-migration.md](phase-01-data-migration.md) | completed | DB had 0 BOTH rows; migration script archived for idempotency |
| 2 | Schema + validation updates | [phase-02-schema-and-validation.md](phase-02-schema-and-validation.md) | completed | schema.prisma + zod enum updated |
| 3 | API + RBAC simplification | [phase-03-api-rbac-simplification.md](phase-03-api-rbac-simplification.md) | completed | Filter expansion + dual-module RBAC dropped |
| 4 | UI cleanup (form, sidebar, nav, pages, export) | [phase-04-ui-cleanup.md](phase-04-ui-cleanup.md) | completed | typecheck + build pass |

## Dependency Graph
phase-01 → phase-02 → phase-03 → phase-04

## Key Risks
- **Phase 1 destructive**: convert BOTH parties wrong-way, lose semantic of dual-role. Mitigation: pick side with higher activity count (orders + deposits); produce CSV report listing decisions for finance review before execution.
- **Phase 3/4 type narrowing**: TypeScript compile errors expected; treat as completion signal — no `BOTH` literal anywhere.

## Rollback
- Phase 1: SQL backup (`pg_dump parties`) before run; restore-from-backup recipe documented in phase file.
- Phase 2-4: pure code; revert via git.

## Success Criteria
- `grep -rn "BOTH" app components lib prisma scripts` returns zero hits in code paths (only allowed in migration script + backup CSV).
- `SELECT count(*) FROM "Party" WHERE type = 'BOTH'` returns 0.
- `pnpm typecheck` and `pnpm build` pass.
- Existing party CRUD + RBAC + parties summary export still work in smoke test.
