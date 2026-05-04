---
title: "Summary report — deposits & bank fees deltas"
description: "Refine /reports/summary: deduct bank fees from customer TT, surface deposits in Thu khác/Chi khác, emit bank-fee rows in Chi khác"
status: completed
priority: P1
effort: 5h
branch: main
tags: [reports, summary, deposits, bank-fees, prisma]
created: 2026-05-04
---

# Summary Report — Deposits & Bank Fees Deltas

## Context
- Prior plan `plans/260420-0109-summary-report-redesign/` (completed) built 4-tab report. This plan only specifies deltas.
- API: `app/api/reports/summary/route.ts`
- Excel: `app/api/reports/summary/export/route.ts` (already has deposit + bank-fee logic — sync API to match)
- UI: `app/(dashboard)/reports/summary/page.tsx`

## Deltas
1. **Thu từ KH `periodPayment`** — deduct `bankFeeOriginal` per PAYMENT tx (thực thu). Debt cols unchanged.
2. **Thu khác** — append customer Deposits created in period (exclude refund-sourced).
3. **Trả NCC** — no change (asymmetric: no fee deduction).
4. **Chi khác** — append (a) supplier Deposits in period (exclude refund-sourced), (b) bank-fee rows from ALL period tx with `bankFeeOriginal>0` (sale + purchase).

## Key Decision: `Deposit.source` enum
Add `source: "MANUAL" | "REFUND"` field (default MANUAL). Cleanest discriminator vs heuristics on DepositUsage. Backfill existing data: set REFUND for deposits that have a usage row with negative amount AND linked tx where `paymentType=REFUND`.

## Phases
| # | Phase | Status | Files |
|---|-------|--------|-------|
| 1 | [Schema: Deposit.source](./phase-01-schema-deposit-source.md) | completed | `prisma/schema.prisma`, `lib/deposit-deduction-service.ts`, migration |
| 2 | [API summary update](./phase-02-api-summary-update.md) | completed | `app/api/reports/summary/route.ts` |
| 3 | [Excel export sync](./phase-03-excel-export-update.md) | completed | `app/api/reports/summary/export/route.ts` |
| 4 | [UI tabs update](./phase-04-ui-update.md) | completed | `app/(dashboard)/reports/summary/page.tsx` |

## Dependencies
- Phase 1 blocks 2, 3 (need `source` field)
- Phase 2 blocks 4 (UI consumes new shape)
- Phase 3 independent of 4

## Asymmetry Note (Documented)
Customer side deducts bank fee from "TT lần này" (we received less). Supplier side does NOT deduct (we paid full to vendor; fee is separate company expense surfaced in Chi khác). Confirmed per spec.

## Rollback
- Phase 1: prisma migrate down + revert service.
- Phase 2-4: revert per file. No data destruction.

## Success Criteria
- `Deposit.source` populated for all rows (no nulls).
- Customer "TT lần này" = `Σ(amountOriginal - bankFeeOriginal)` for in-period PAYMENT tx.
- Thu khác lists manual customer deposits + standalone RECEIPTs (no refund-deposits).
- Chi khác lists standalone PAYMENTs + manual supplier deposits + per-tx bank-fee rows.
- Excel and UI render identical row sets per BU.

## Validation Log (Session 1 — 2026-05-04)
- **Backfill `Deposit.source`:** Heuristic — set REFUND when deposit has DepositUsage→tx with `paymentType=REFUND` near deposit createdAt. Default MANUAL.
- **Bank-fee rows in Chi khác:** One row per source tx. Label = `"Phí NH — {partyName} {orderNumber}"`. Date = `tx.transactionDate`.
- **Sort order in Thu khác / Chi khác:** Interleaved by date asc across all row types (transaction / deposit / bankFee).
- **BOTH party type:** USER DECISION — eliminate `BOTH` entirely. Spin off as separate prerequisite plan (touches schema, parties API, party form, sidebar, RBAC, party detail page). This plan becomes `blockedBy` that one.

## Blockers
- Pending separate plan: remove `Party.type === "BOTH"` (CUSTOMER or SUPPLIER only). Once merged, deposit routing in phase-02/phase-03 simplifies to a direct check on `party.type`.
