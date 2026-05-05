---
title: "Summary report — surface REFUND tx as Chi/Thu khác rows"
description: "Add order-linked REFUND tx (non-DEPOSIT) into otherPayments (SALE) / otherReceipts (PURCHASE); keep existing periodPayment netting"
status: completed
priority: P2
effort: 2h
branch: main
tags: [reports, summary, refund]
created: 2026-05-05
blockedBy: []
blocks: []
---

# Summary — REFUND rows in Chi/Thu khác

## Context
- Builds on `plans/260505-0019-summary-debt-with-adjustments-and-refunds/` (completed).
- That plan documented routing REFUND→Chi/Thu khác, but implementation chose to **net** REFUND into `periodPayment` only (see `app/api/reports/summary/route.ts:261-262` and `app/api/reports/summary/export/route.ts:304`). REFUND rows currently invisible in standalone tabs.
- User wants REFUND tx surfaced as rows in Chi khác (SALE) / Thu khác (PURCHASE) **AND** keep the existing periodPayment netting (intentional double view).

## Decisions (confirmed)
1. Filter: order-linked REFUND, `paymentMethod != "DEPOSIT"`, `transactionDate ∈ period`.
2. Routing: `order.type === "SALE"` → `otherPayments`; `order.type === "PURCHASE"` → `otherReceipts`.
3. Net behavior: keep `periodPayment` netting AS-IS. Add new rows that DO contribute to Chi/Thu khác subtotals (user explicitly chose double-count view — column "TT lần này" reflects order debt impact, Chi/Thu khác reflects bank cash movement).
4. Row shape: reuse `StandaloneRow` with `rowType: "refund"`, label `"Hoàn tiền — {party} {orderNumber}"`, amount = `amountOriginal` (positive).
5. Scope: API + Excel + UI subtotal/labels (no schema, no new endpoint).

## Phases
| # | Phase | Status | Files |
|---|-------|--------|-------|
| 1 | [API: emit refund rows](./phase-01-api-refund-rows.md) | completed | `app/api/reports/summary/route.ts` |
| 2 | [Excel export parity](./phase-02-excel-refund-rows.md) | completed | `app/api/reports/summary/export/route.ts` |
| 3 | [UI verify rendering + subtotals](./phase-03-ui-verify.md) | completed | `app/(dashboard)/reports/summary/page.tsx` |

## Dependencies
Phase 1 → 2 (parity reference) → 3 (consume new rowType).

## Success Criteria
- SALE order with in-period REFUND 5 (BANK): row appears in Chi khác, contributes 5 to Chi khác subtotal; "TT lần này" = paid − 5 (unchanged).
- PURCHASE order REFUND → Thu khác.
- DEPOSIT-method REFUND skipped (already auto-creates Deposit, would double-count).
- Excel and API agree on every numeric field and row count.
- UI renders refund rows with correct label and currency.

## Rollback
Per-file revert. No schema/migration.

## Open Questions
None.
