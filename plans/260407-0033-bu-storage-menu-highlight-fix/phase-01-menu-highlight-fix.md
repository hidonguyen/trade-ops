---
phase: 1
status: planned
priority: high
---

# Phase 1: Menu Highlight Fix

## Problem
Sidebar active state uses only pathname, ignoring query params. Menu items sharing the same base path (e.g., `/orders`) all highlight together.

**Root cause:** `sidebar.tsx:94` — `item.href.split("?")[0]` discards the `type` query param that distinguishes SALE from PURCHASE.

**Secondary issue:** Pages (`orders/page.tsx`, `parties/page.tsx`) don't read `type` from URL search params, so clicking "Đơn bán" navigates to `/orders?type=SALE` but page starts with empty filter.

## Solution

### A. Sidebar: Match query params for active state
In `sidebar.tsx`, use `useSearchParams()` alongside `usePathname()`:
- Extract `type` param from both `item.href` and current URL
- Active = pathname matches AND type param matches (or item has no type param)

```tsx
// Before
const basePath = item.href.split("?")[0];
const isActive = pathname === basePath || pathname.startsWith(basePath + "/");

// After
const [itemPath, itemQuery] = item.href.split("?");
const itemType = new URLSearchParams(itemQuery || "").get("type");
const currentType = searchParams.get("type");
const isActive = (pathname === itemPath || pathname.startsWith(itemPath + "/"))
  && (!itemType || itemType === currentType);
```

### B. Pages: Read initial `type` from URL search params
In `orders/page.tsx` and `parties/page.tsx`:
- Use `useSearchParams()` to read `type` on mount
- Set as initial filter value

## Files to Modify
- `components/layout/sidebar.tsx` — active state logic
- `app/(dashboard)/orders/page.tsx` — read `type` from URL
- `app/(dashboard)/parties/page.tsx` — read `type` from URL

## Todo
- [ ] Update sidebar active state to compare query params
- [ ] Orders page: read `type` from URL search params as initial filter
- [ ] Parties page: read `type` from URL search params as initial filter
- [ ] Verify only correct menu item highlights
