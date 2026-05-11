---
title: "Accountant role restriction + 5 UX refinements"
description: "Restrict ACCOUNTANT_CASHFLOW to view-only on payments, default orders sort desc, default party type on create, add CASH payment method, calendar year/month dropdown navigation, multi-select on ALL combobox filters."
status: planned
priority: P2
effort: 7h
branch: main
tags: [rbac, ui, filters, payment-method, ux]
created: 2026-05-12
blockedBy: []
blocks: []
---

# Accountant Role & UI Refinements

Batch of 6 small, independent improvements. Each phase is self-contained.

## Phases

| # | Phase | Status | Effort |
|---|-------|--------|--------|
| 01 | [Accountant role restrict to view-only on payments](./phase-01-accountant-role-restrict.md) | pending | 30m |
| 02 | [Orders default sort by orderDate DESC, orderNumber DESC](./phase-02-orders-default-sort-desc.md) | pending | 30m |
| 03 | [Party create: default type from referrer menu](./phase-03-party-create-default-type.md) | pending | 45m |
| 04 | [Payment method: add CASH (Tiền mặt)](./phase-04-payment-method-cash.md) | pending | 1h |
| 05 | [Calendar year/month dropdown navigation](./phase-05-date-filter-year-month-quick.md) | pending | 1h |
| 06 | [Multi-select on ALL combobox filters (13 across 7 pages)](./phase-06-multi-select-combobox-filters.md) | pending | 3h |

## Cross-plan notes

- Plan `260415-2344-orders-filter-reorder-add` (Đối tác combobox on orders) — verify implementation: `app/(dashboard)/orders/page.tsx:158` confirms the filter order already includes đối tác. Mark that plan as completed when this plan starts.
- Plan `260419-1455-date-filter-quick-presets` already shipped (separate concern: preset bar). Phase 05 here changes the **calendar widget itself** (`components/ui/date-picker.tsx`) — adds year+month dropdowns inside the calendar caption via react-day-picker v9 `captionLayout="dropdown"`. No overlap with the preset bar.
- Recent `23eee13 fix(rbac)` enforces matrix in `lib/rbac.ts` — phase 01 only changes the matrix data, not the enforcement code.

## Key dependencies

- Phases are **independent** — can ship in any order.
- Phase 05 owns `components/ui/date-picker.tsx`; phase 06 owns `components/ui/multi-combobox.tsx` (new) + `components/shared/filter-bar.tsx`. No file conflicts.

## Success criteria

- ACCOUNTANT_CASHFLOW cannot POST/PUT/DELETE `/api/transactions` (PAYMENT module).
- Orders list shows newest `orderDate` first; ties broken by `orderNumber DESC` on initial load.
- "/parties/new" prefills CUSTOMER when accessed from customers menu, SUPPLIER from suppliers menu.
- CASH appears in payment method select, persists to DB, exports correctly in Excel/reports.
- Calendar widget shows clickable year + month dropdowns in its caption; selecting year/month jumps grid without chevron stepping.
- Selecting 2+ values in any of the 13 combobox filters returns union; URL serializes as CSV; backend uses Prisma `{ in: [...] }`; legacy single-value URLs still work.
