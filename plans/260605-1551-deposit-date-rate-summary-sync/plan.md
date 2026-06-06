---
title: 'Deposit date + exchange rate, synced on summary report'
description: >-
  Add user-editable date + exchange rate to customer/supplier deposits; surface
  rate and VND-converted amount on the summary report (web + Excel).
status: completed
priority: P2
branch: main
tags:
  - deposits
  - reports
  - multi-currency
blockedBy: []
blocks: []
created: '2026-06-06T14:38:30.192Z'
createdBy: 'ck:plan'
source: skill
---

# Deposit date + exchange rate, synced on summary report

## Overview

Deposits today carry only `createdAt` (no user-editable date) and no `exchangeRate`. The summary report ("Báo cáo tổng hợp") keys deposit rows off `createdAt` and shows VND = 0 for them. This plan adds:

1. `depositDate` (user-editable, default today) and `exchangeRate` (default 1) to the `Deposit` model.
2. Form/edit/list UI to capture and show both fields.
3. Summary report (web table + Excel export) synced: filter/sort deposits by `depositDate`, show a **Tỉ giá** column, and compute **Quy đổi VND = amountOriginal × exchangeRate** (replacing the hardcoded `0`).

**Confirmed decisions (from user):**
- `depositDate`: separate editable field, default today on create, editable on edit, existing rows backfilled to `createdAt`.
- `exchangeRate`: drives VND conversion on the report (amount × rate), not display-only.
- Report date basis: `depositDate`.
- Existing deposits backfill `exchangeRate = 1`.

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [Schema & Migration](./phase-01-schema-migration.md) | Completed |
| 2 | [Deposit API & Validation](./phase-02-deposit-api-validation.md) | Completed |
| 3 | [Deposit UI](./phase-03-deposit-ui.md) | Completed |
| 4 | [Summary Report Sync](./phase-04-summary-report-sync.md) | Completed |

## Key Dependencies

- Sequential: Phase 1 (schema) → Phase 2 (API) → Phase 3 (UI) and Phase 4 (report) both depend on Phase 1+2.
- Phases 3 and 4 are independent of each other and can be done in parallel after Phase 2.
- Precedent to mirror: `Order.exchangeRate Decimal @default(1) @db.Decimal(18,8)` (`schema.prisma:166`), `Order.orderDate DateTime` (`schema.prisma:167`), and `dateField` / `decimalString` validators (`lib/validation-schemas.ts:7,43`).

## Dependencies

No cross-plan blockers. Related shipped plans (historical, completed): `260504-2224-summary-report-deposits-and-fees`, `260505-0218-deposit-tracking-master-detail`, `260424-0751-deposit-edit-delete`. This plan extends their surfaces; none are unfinished.

## Out of Scope

- Deposit Tracking report (`/api/reports/deposits`) rate/VND columns — user asked only for "báo cáo tổng hợp" (summary). Note as optional follow-up.
- Recomputing `remainingOriginal` in VND — balances stay in original currency; rate is metadata for reporting only.
- VND column for non-deposit standalone rows (transactions/fees/refunds) — deposit-only per request; bank-fee rows have a different amount basis, so a blanket VND would be wrong. Non-deposit rows render "—".

## Red Team Review

### Session — 2026-06-06
**Findings:** 11 accepted, 2 rejected (3 hostile reviewers: Security Adversary, Failure Mode Analyst, Assumption Destroyer). All passed the file:line evidence filter.
**Severity breakdown:** 2 Critical, 4 High, 5 Medium (accepted).

| # | Finding | Severity | Disposition | Applied To |
|---|---------|----------|-------------|------------|
| 1 | Date-range boundary uses server-local `setHours` while `depositDate` stored UTC midnight → edge deposits vanish | Critical | Accept | Completed |
| 2 | Excel export deposit filter/orderBy/date not actually switched to `depositDate` → web/Excel disagree | Critical | Accept | Completed |
| 3 | Migration prose claims a "temporary default" the SQL never creates | High | Accept | Completed |
| 4 | Index `[businessUnitId, depositDate]` omits `source` from the real query predicate | High | Accept | Completed |
| 5 | VND-for-all-rows is wrong (fee rows use `bankFeeOriginal`) + misleading "add to select" | High | Accept | Phase 4 §1 |
| 6 | Date-picker primitive `components/ui/date-picker.tsx` exists; native-input fallback is wrong | High | Accept | Phase 3 |
| 7 | POST audit logs raw `validation.data` → omitted date never audited; log persisted row | High | Accept | Phase 2 |
| 8 | DELETE audit snapshot omits new fields | Medium | Accept | Phase 2 |
| 9 | `exchangeRate` unbounded → `1e20` overflow / `0.000000001` rounds to 0 (re-creates VND=0 bug) | Medium | Accept | Phase 2 |
| 10 | `new Decimal(prismaDecimal)` without `.toString()` diverges from convention | Medium | Accept | Phase 4 §1 |
| 11 | Customer/supplier branch polarity differs API vs export → caution note | Medium | Accept | Phase 4 §3 |
| — | Use `migrate deploy` not `migrate dev` to apply `--create-only` | — | Reject | `migrate dev` is correct in dev |
| — | Cross-BU data leak in report VND | — | Reject | Both queries scope by BU (reviewer self-retracted) |

**Surfaced business decision (not auto-applied):** Should `exchangeRate`/`depositDate` be locked once a deposit has `DepositUsage` rows (editing rate restates a consumed deposit's VND on past report renders)? **User decision: keep editable** — deposits hold no VND ledger balance (usages are original-currency), `amountOriginal` is already editable post-usage, and rate/date only affect report display. Rationale documented in Phase 2 "Edit policy".

### Whole-Plan Consistency Sweep
Re-read all phase files after applying findings. Reconciled:
- Index name `[businessUnitId, source, depositDate]` consistent across Phase 1 schema/SQL/success-criteria.
- "Editable, not usage-locked" stated once in Phase 2 and referenced (not re-decided) in Phase 3.
- VND scope: "deposit rows only, non-deposit → —" consistent across Phase 4 Requirements/Architecture/Success/Risk and plan Out-of-Scope.
- UTC date-range fix referenced as a prerequisite in Phase 4 §0 and reflected in Related Code Files + Success Criteria.
- No `select`-conversion instruction remains (both report queries documented as `include`, scalars auto-returned).
- No stale "temporary default" / native-date-input / VND-for-all-rows language remains.

**Unresolved contradictions:** none.
