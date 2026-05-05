---
title: "Reports — clickable open-in-new-tab column for order rows"
description: "Add external-link icon column to summary/cashflow/deposits reports; clicking opens /orders/[id] in new tab. Standalone tx rows non-clickable."
status: completed
priority: P2
effort: 2h
branch: main
tags: [reports, ui, ux]
created: 2026-05-05
blockedBy: []
blocks: []
---

# Reports — Clickable Order Link Column

## Context
- Three reports affected: Summary, Cashflow, Deposits.
- Order detail page exists at `/orders/[id]`. Transaction detail page does **not** exist.
- User decision: row giao dịch standalone (không link order) → KHÔNG cho click.

## Decisions (confirmed)
1. Trigger: separate trailing column with external-link icon (not whole-row click, not link-on-orderNumber).
2. Behavior: `<a href="/orders/{orderId}" target="_blank" rel="noopener noreferrer">` opens in new tab.
3. Visibility: icon only renders when row has `orderId`. For non-linked rows render empty cell (or `—`).
4. Scope: 3 report pages (summary, cashflow, deposits) + minor API additions to expose `orderId` where missing.

## API gaps
| Report | Endpoint | Has orderId today? | Action |
|--------|----------|--------------------|--------|
| Summary | `/api/reports/summary` | DebtRow has `orderId`. Standalone rows (`StandaloneRow`) lack `orderId` for refund/bankFee rows | Add optional `orderId` to StandaloneRow; populate for `refund` and `bankFee` (already have order ref) |
| Cashflow | `/api/cashflow-report` (or similar) | Row has `orderNumber` only | Add `orderId: string \| null` to row shape |
| Deposits | `/api/reports/deposits` | Master has no order; usages link to tx → tx has `orderId` | Add `orderId` to usage row |

## Phases
| # | Phase | Status | Files |
|---|-------|--------|-------|
| 1 | [API: expose orderId where missing](./phase-01-api-expose-orderid.md) | completed | summary route, cashflow route, deposits route |
| 2 | [UI: add link column to 3 reports](./phase-02-ui-link-column.md) | completed | 3 page.tsx files |

## Dependencies
Phase 1 → Phase 2.

## Success Criteria
- Each of 3 reports shows new trailing column with icon for rows linked to an order.
- Clicking icon opens `/orders/{id}` in new tab; current tab unchanged.
- Standalone tx rows show empty cell.
- No TS errors introduced.

## Rollback
Per-file revert. No schema change.

## Open Questions
None.
