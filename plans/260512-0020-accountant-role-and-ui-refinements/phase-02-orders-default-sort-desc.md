# Phase 02 — Orders default sort by date DESC

## Context

- `lib/api-helpers.ts:31`: `parsePagination` defaults `sortBy=createdAt`, `order=desc`.
- `app/api/orders/route.ts:87`: `orderBy: { [sortBy]: order }`.
- User wants orders (SALE + PURCHASE) defaulted to `orderDate desc`. Other endpoints (parties, transactions) should keep current default.

## Requirements

- Both sale and purchase order lists initially render newest order-date first.
- User can still override via column sort.

## Files

- Modify: `app/api/orders/route.ts` (override default `sortBy` to `orderDate` when not provided).
- Modify: `app/(dashboard)/orders/page.tsx` (ensure initial fetch does not pass `sortBy=createdAt`; allow API default).

## Implementation steps

1. In `app/api/orders/route.ts`, after `parsePagination`, override:
   ```ts
   const sortBy = searchParams.get("sortBy") || "orderDate";
   const order = (searchParams.get("order") as "asc" | "desc") || "desc";
   // when defaulting (no explicit sortBy), apply secondary sort on orderNumber DESC
   const orderBy = searchParams.get("sortBy")
     ? { [sortBy]: order }
     : [{ orderDate: "desc" as const }, { orderNumber: "asc" as const }];
   ```
2. In `app/(dashboard)/orders/page.tsx`, confirm initial table state uses `orderDate desc` so column sort indicator matches.
3. Test: open `/orders?type=SALE` and `/orders?type=PURCHASE`; verify rows ordered desc by `orderDate` and same-day rows ordered by `orderNumber` asc (lowest sequential number first within the day).

## Sort decision (user-confirmed)

- Primary: `orderDate DESC`.
- Secondary tie-breaker: `orderNumber ASC` (user-confirmed). Rationale: within the same day, show orders in the order they were created (lowest orderNumber first). Deterministic for display + Excel exports.
- Only applies when caller does not pass explicit `sortBy` (i.e., default load). When user clicks a column header to sort, single-column behavior remains.

## Todo

- [ ] Override default sortBy in orders API with array orderBy `[orderDate desc, orderNumber asc]`
- [ ] Sync default in orders page initial sort state (header indicator shows orderDate desc)
- [ ] Manual verify both tabs (SALE / PURCHASE) — same-day orders show highest orderNumber first
- [ ] Pagination still correct on page 2+ (orderBy array works with skip/take)

## Success criteria

- First page row 0 has max `orderDate` across all orders.
- Among rows sharing the same `orderDate`, rows ordered by `orderNumber ASC`.
- Sort indicator on `orderDate` column shows desc by default.
- Explicit user sort on another column overrides both keys.

## Risks

- **Low**: Prisma array `orderBy` requires v3+; project already on modern Prisma — verified safe.
- **Low**: orderNumber lexicographic vs numeric sort — confirm orderNumber field type. If string with consistent zero-padding/prefix, DESC works as expected. If varying widths (e.g., `PO-9` vs `PO-10`), revisit (likely acceptable for current data shape).
