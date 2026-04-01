---
title: "Trade Ops Full Implementation"
description: "8-phase parallel implementation plan for Vietnamese import/export financial management app"
status: pending
priority: P1
effort: 40h
branch: main
tags: [fullstack, nextjs, prisma, rbac, multi-currency]
created: 2026-04-02
---

# Trade Ops Implementation Plan

## Dependency Graph

```
Phase 1 (Foundation) ─── SEQUENTIAL GATE
  ├──> Phase 2 (Catalog+Party+Deposit API)  ──> Phase 6 (Settings+Party UI)
  ├──> Phase 3 (Order+Transaction API)       ──> Phase 7 (Orders+Tx UI)
  ├──> Phase 4 (Report+Admin API)            ──> Phase 8 (Reports+Dashboard UI)
  └──> Phase 5 (Layout+Shared Components)    ──> Phase 6, 7, 8
```

## Parallel Execution Groups

| Group | Phases | Blocker | Est. Effort |
|-------|--------|---------|-------------|
| Gate  | 1      | None    | 8h          |
| A     | 2,3,4,5 | Phase 1 | 5h each (20h) |
| B     | 6,7,8  | API phase + Phase 5 | 4h each (12h) |

## Phase Summary

| # | Phase | Status | File | Blocks |
|---|-------|--------|------|--------|
| 1 | Foundation Setup | Planned | [phase-01](phase-01-foundation-setup.md) | 2,3,4,5 |
| 2 | Catalog+Party+Deposit API | Planned | [phase-02](phase-02-catalog-party-deposit-api.md) | 6 |
| 3 | Order+Transaction API | Planned | [phase-03](phase-03-order-transaction-api.md) | 7 |
| 4 | Reports+Admin API | Planned | [phase-04](phase-04-reports-admin-api.md) | 8 |
| 5 | Layout+Shared Components | Planned | [phase-05](phase-05-layout-shared-components.md) | 6,7,8 |
| 6 | Settings+Party+Deposit UI | Planned | [phase-06](phase-06-settings-party-deposit-ui.md) | - |
| 7 | Orders+Transactions+Cashflow UI | Planned | [phase-07](phase-07-orders-transactions-cashflow-ui.md) | - |
| 8 | Reports+Dashboard+Admin UI | Planned | [phase-08](phase-08-reports-dashboard-admin-ui.md) | - |

## Key Architecture Decisions

- All money: `Decimal @db.Decimal(18,4)`, Decimal.js in code, never float
- `amountVnd`: FE computes & sends, BE stores as-is
- Currency display: single amount column with symbol inline ($, Y, D)
- API pattern: `withAuth > checkAccess > zod validate > prisma.$transaction > auditLog > apiResponse`
- Response: `{ success, data?, message?, errors? }`
- RBAC: 5 roles, union permissions, FULL > GET > DENY

## Related Docs

- [System Architecture](../../docs/system-architecture.md)
- [Code Standards](../../docs/code-standards.md)
- [Design Guidelines](../../docs/design-guidelines.md)
- [Codebase Summary](../../docs/codebase-summary.md)
- [Deployment Guide](../../docs/deployment-guide.md)
- [Wireframes](../../docs/wireframes/)

## Rollback Strategy

Each phase is independently revertable via `git revert` on its merge commit.
Phase 1 is the only hard dependency; if it fails, no other phase can proceed.
Group B phases (UI) can be reverted without affecting API phases.
