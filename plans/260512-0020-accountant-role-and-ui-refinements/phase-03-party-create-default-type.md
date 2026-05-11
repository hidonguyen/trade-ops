# Phase 03 — Party create: default type from referrer menu

## Context

- `app/(dashboard)/parties/new/page.tsx` renders `<PartyForm mode="create" />` with no preset type.
- `app/(dashboard)/parties/page.tsx` is the list page filtered by `?type=CUSTOMER|SUPPLIER`.
- User wants: clicking "Tạo mới" from customers list → form starts with type=CUSTOMER; from suppliers list → SUPPLIER.

## Requirements

- Read URL query `?type=CUSTOMER|SUPPLIER` in `/parties/new`.
- Pass as default to `PartyForm`.
- If absent (direct nav), keep current default (no preset / first option).

## Files

- Modify: `app/(dashboard)/parties/new/page.tsx`
- Modify: `components/party-form.tsx` (accept `defaultType` prop)
- Modify: `app/(dashboard)/parties/page.tsx` ("Tạo mới" link should carry `?type=` from current filter)

## Implementation steps

1. In `parties/new/page.tsx`: convert to read `useSearchParams()` for `type`, validate `CUSTOMER|SUPPLIER`, pass `defaultType` to `<PartyForm>`.
2. In `components/party-form.tsx`: accept `defaultType?: "CUSTOMER" | "SUPPLIER"` prop and apply only on `mode === "create"`.
3. In `parties/page.tsx`: append `?type=${currentType}` to "Tạo mới" button href when a type filter is active.

## Todo

- [ ] Add `defaultType` prop to PartyForm
- [ ] Read URL param in new page
- [ ] Update Tạo mới link in list
- [ ] Smoke test both menus

## Success criteria

- Click Customers → Tạo mới → form type field = CUSTOMER (selected).
- Same for Suppliers → SUPPLIER.

## Risks

- **Low**. If user changes the type before submitting, behavior unchanged.
