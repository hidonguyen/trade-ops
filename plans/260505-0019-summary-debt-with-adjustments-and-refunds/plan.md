---
title: "Summary report — debt formulas + refund routing + VND policy"
description: "Apply effectiveValue (orderAmt + Σadj) to priorDebt/remainingDebt, route REFUND tx to Thu khác/Chi khác by order type, keep VND only on periodPayment"
status: completed
priority: P1
effort: 3h
branch: main
tags: [reports, summary, adjustments, refunds, vnd]
created: 2026-05-05
blockedBy: []
blocks: []
---

# Summary Report — Debt with Adjustments & Refunds

## Context
- Builds on completed plan `plans/260504-2224-summary-report-deposits-and-fees/` (deposits + bank-fee deltas).
- Canonical formula (already in `lib/order-status-calculator.ts`, `app/api/orders/[id]/report/route.ts`):
  - `effectiveValue = orderAmount + Σ(ADJUSTMENT)`
  - `netPaid = Σ(PAYMENT) − Σ(REFUND)`
  - `balance = max(effectiveValue − Σ(PAYMENT) + Σ(REFUND), 0)`
- Summary report currently ignores ADJUSTMENT and REFUND in debt columns.

## User Decisions (validated)
1. **TT lần này (periodPayment)** = `Σ(PAYMENT in period) − Σ(bankFee in period)` only (unchanged). REFUND does not net here.
2. **REFUND routing** in standalone tabs:
   - SALE order REFUND → **Chi khác** (we paid customer back).
   - PURCHASE order REFUND → **Thu khác** (supplier paid us back).
3. **Nợ cũ / Nợ còn lại** include all ADJUSTMENTs (no date-split): `effectiveValue` uses `Σ(ADJ all)`.
4. **VND** displayed **only** on TT lần này (already present per-tx). Debt columns show original currency only. KISS.

## Formulas

| Column | Formula |
|--------|---------|
| Nợ cũ (priorDebt) | `max(effectiveValue − Σ(PAYMENT before period) + Σ(REFUND before period), 0)` |
| TT lần này (periodPayment) | `Σ(PAYMENT in period.amountOriginal − bankFeeOriginal)` (customer side); `Σ(PAYMENT in period.amountOriginal)` (supplier side) |
| Nợ còn lại (remainingDebt) | `max(effectiveValue − Σ(PAYMENT all) + Σ(REFUND all), 0)` |
| TT lần này VND | `Σ(PAYMENT in period.amountVnd − bankFeeVnd)` (customer); `Σ(PAYMENT in period.amountVnd)` (supplier). Optional in API; already in Excel. |

`effectiveValue = orderAmt + Σ(ADJUSTMENT all)` — adjustments are not date-split.

## Refund Routing (Standalone Tabs)

For every order-linked REFUND tx with `transactionDate` in period, emit one row:
- `rowType = "refund"`
- `partyName = order.party.name`
- `label = "Hoàn tiền — {party} {orderNumber}"`
- `amountOriginal = tx.amountOriginal` (positive value, cashflow direction is encoded by which tab it lands in)
- Routing: `order.type === "SALE"` → otherPayments; `order.type === "PURCHASE"` → otherReceipts.
- Sort interleaved with other rows by date ASC.

`paymentMethod = "DEPOSIT"` REFUND tx already represents a credit to a deposit balance (auto-creates a REFUND-sourced Deposit per phase 1 of prior plan). Those should NOT emit a refund row in standalone tabs (would double-count with the suppressed REFUND deposit). Rule: skip REFUND tx where `paymentMethod = "DEPOSIT"`.

## Phases
| # | Phase | Status | Files |
|---|-------|--------|-------|
| 1 | [API formulas + refund routing](./phase-01-api-debt-and-refunds.md) | completed | `app/api/reports/summary/route.ts` |
| 2 | [Excel export sync](./phase-02-excel-export-sync.md) | completed | `app/api/reports/summary/export/route.ts` |
| 3 | [UI verify](./phase-03-ui-verify.md) | completed | `app/(dashboard)/reports/summary/page.tsx` |

## Dependencies
- Phase 1 → Phase 2 (parity reference)
- Phase 1 → Phase 3 (UI consumes new shape)

## Success Criteria
- For SALE order with `orderAmt=100, ADJ=+10, paid=80, refund=5`: effectiveValue=110, balance=110−80+5=35.
- Period-split sample: pre-period payment 50, in-period payment 30 + refund 5, post-period 0 → priorDebt = 110−50 = 60, periodPayment = 30 (raw, then minus fee), remainingDebt = 110−80+5 = 35; refund row appears in Chi khác.
- Excel and API agree on every numeric field.
- Debt cols render currency-symbol only (no VND number).

## Rollback
- Per-file revert. No schema change.

## Open Questions
- Should periodPayment in API also expose `amountVnd`? Excel has it; API caller (UI) doesn't currently use it. Defer until UI needs.
- Should ADJUSTMENT transactions appear as their own row in Thu khác / Chi khác (signed)? Currently invisible. User did not request — defer.
