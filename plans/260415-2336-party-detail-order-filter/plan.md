---
title: Party detail → Orders navigation + partyId filter fix
created: 2026-04-15
status: planned
mode: fast
blockedBy: []
blocks: []
---

# Party Detail → Orders Navigation + Filter Fix

## Problem

1. **Party detail page** has single generic "Xem đơn hàng" button. Should route to:
   - CUSTOMER → `/orders?type=SALE&partyId=...`
   - SUPPLIER → `/orders?type=PURCHASE&partyId=...`
   - BOTH → show 2 buttons: "Xem đơn bán" + "Xem đơn mua"
2. **Orders list page** ignores `partyId` from URL. API supports it, UI does not read/send it. Filter breaks after navigation.

## Scope

Single phase. Two file edits.

## Phases

- [x] Phase 01 — UI: party detail buttons + orders page partyId URL sync → [phase-01-party-order-nav-filter.md](./phase-01-party-order-nav-filter.md)

## Key Files

- `app/(dashboard)/parties/[id]/page.tsx` — button rendering by party type
- `app/(dashboard)/orders/page.tsx` — read `partyId` from URL, include in fetch, show indicator

## Success Criteria

- CUSTOMER party detail shows only "Xem đơn bán" → navigates to sales list filtered by this party
- SUPPLIER party detail shows only "Xem đơn mua" → navigates to purchase list filtered by this party
- BOTH party detail shows both buttons
- Orders page respects `partyId` URL param, filters API call correctly
- Visual indicator on orders page when filtered by party (show party name + clear-filter action)
