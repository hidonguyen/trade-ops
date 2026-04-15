# Phase 03 — UI: rename order "Ghi chú" → "Diễn giải"

## Overview
- Priority: Low (independent of schema)
- Status: pending
- Depends on: none

UI-only label change. DB column `Order.notes` unchanged.

## Files

- `components/order-form.tsx` — line ~214 (`<Label>Ghi chú</Label>` + placeholder `"Ghi chú..."`)
- `app/(dashboard)/orders/[id]/order-info-card.tsx` — line 82 (`dt` label `Ghi chú`)
- Any other place displaying `order.notes` label — grep before editing

## Steps

1. Grep `Ghi chú` in `app/` + `components/` scope to find all occurrences referring to order `notes`.
2. Replace order-related labels with `Diễn giải`.
3. Replace input placeholders accordingly.
4. **Do not** rename transaction `notes` labels (they remain "Ghi chú" or keep as-is per current UX).
5. Keep DB field + API payload key as `notes`.

## Todo

- [ ] Grep all `Ghi chú` in order-related components
- [ ] Rename label + placeholder in `order-form.tsx`
- [ ] Rename label in `order-info-card.tsx`
- [ ] Verify no transaction UI label accidentally touched
- [ ] Run dev server, visually confirm

## Success Criteria

- Order create/edit form shows "Diễn giải".
- Order detail card shows "Diễn giải".
- Transaction UI unchanged.

## Risks

- Over-reaching grep — ensure scope is order-related only.
