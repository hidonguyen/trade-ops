---
title: Orders filter — reorder + add order-number / party filters
created: 2026-04-15
status: planned
mode: fast
blockedBy: []
blocks: []
related: [260415-2336-party-detail-order-filter]
---

# Orders Filter — Reorder + Add New Filters

## Problem

Orders list page filter bar needs:
1. Reorder controls to: **Từ ngày–Đến ngày → Số đơn → Đối tác → Trạng thái thanh toán → Loại chi phí (PURCHASE only)**
2. Add "Số đơn" partial-match search filter (currently absent)
3. Add "Đối tác" combobox filter (currently only set by URL from party detail page)

## Scope

Single phase. Touches orders API (+ orderNumber search) and orders page (new filter configs + state wiring).

## Phases

- [x] Phase 01 — Add filters, reorder, wire API search → [phase-01-filter-reorder-add.md](./phase-01-filter-reorder-add.md)

## Key Files

- `app/api/orders/route.ts` — add `orderNumber` partial-match query param
- `app/(dashboard)/orders/page.tsx` — new filter configs + fetch wiring
- `components/shared/filter-bar.tsx` — (no change; already supports `search` + `select`)

## Related

- Builds on `plans/260415-2336-party-detail-order-filter/` which wired `partyId` URL sync — now exposing it as an interactive filter.

## Success Criteria

- Filter bar order matches spec (date-range first, expense-type last on PURCHASE)
- "Số đơn" search field filters list by partial orderNumber match (case-insensitive)
- "Đối tác" combobox loads parties scoped to page `type` (SALE → CUSTOMER/BOTH, PURCHASE → SUPPLIER/BOTH) and filters list
- Existing URL-driven `partyId` filter still works (party detail → orders nav)
- No regressions in status / date / expense-type filters
