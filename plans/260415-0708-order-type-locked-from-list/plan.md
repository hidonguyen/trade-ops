---
title: Lock order type when creating from Sales/Purchase list
created: 2026-04-15
status: completed
blockedBy: []
blocks: []
---

# Overview

When user clicks "Tạo đơn" on `/orders?type=SALE` or `/orders?type=PURCHASE`:
- Route carries `type` to `/orders/new?type=<SALE|PURCHASE>`
- Create page passes it as `initialData.type` to `OrderForm` and disables the type combobox
- Fallback: direct navigation to `/orders/new` (no query) keeps current behavior (SALE default, user-editable)

## Trivial scope

Single phase. No backend change. No schema change.

## Files

- `app/(dashboard)/orders/page.tsx` — append `?type=<current>` when pushing to new order page
- `app/(dashboard)/orders/new/page.tsx` — read `?type=` via `useSearchParams`, pass to `OrderForm` as `initialData.type` + new `lockType` flag
- `components/order-form.tsx` — accept `lockType?: boolean` prop; combobox `disabled = mode === "edit" || lockType`

## Implementation

```tsx
// orders/page.tsx
<Button onClick={() => router.push(urlType ? `/orders/new?type=${urlType}` : "/orders/new")}>
  Tạo đơn
</Button>

// orders/new/page.tsx
const search = useSearchParams();
const type = search.get("type") === "PURCHASE" ? "PURCHASE" : search.get("type") === "SALE" ? "SALE" : undefined;
<OrderForm
  mode="create"
  onSubmit={handleSubmit}
  initialData={type ? { type } : undefined}
  lockType={Boolean(type)}
/>

// order-form.tsx
interface OrderFormProps {
  // ...
  lockType?: boolean;
}
<Combobox disabled={mode === "edit" || lockType} ... />
```

## Todo

- [ ] Pass `type` query when navigating from orders list
- [ ] Read query in new-order page, forward to form
- [ ] `OrderForm` accepts `lockType` prop, disables combobox when set
- [ ] Type-check passes
- [ ] Manual: visit `/orders?type=SALE`, click "Tạo đơn" → type="SALE", disabled
- [ ] Manual: visit `/orders?type=PURCHASE`, click "Tạo đơn" → type="PURCHASE", disabled
- [ ] Manual: visit `/orders` (no filter), click "Tạo đơn" → type editable (current behavior)

## Success Criteria

- Type combobox is disabled + shows correct value when arriving with query param.
- No regression on edit mode (already disabled) and no-query create flow.

## Risks

- None material. Keep "SALE" as UI default if query malformed.
