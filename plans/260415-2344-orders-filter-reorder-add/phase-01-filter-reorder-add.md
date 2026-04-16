# Phase 01 — Filter reorder + orderNumber/party filters

## Context Links
- [plan.md](./plan.md)
- Related prior plan: `plans/260415-2336-party-detail-order-filter/` (wired `partyId` URL sync)
- `app/(dashboard)/orders/page.tsx`
- `app/api/orders/route.ts`
- `components/shared/filter-bar.tsx`
- `components/ui/combobox.tsx`

## Overview
- **Priority:** Medium (UX polish + missing filters)
- **Status:** Planned
- **Brief:** Reorder filter bar, add "Số đơn" search + "Đối tác" combobox filter, wire API partial match for orderNumber.

## Key Insights

- `FilterBar` supports `select`, `search`, `date`, `date-range`. The `select` type uses `Combobox` which supports typeahead — fine for party list even with 100+ entries.
- Orders API supports: `type`, `status`, `businessUnitId`, `partyId`, `expenseTypeId`, `dateFrom/dateTo`. Missing: `orderNumber` search.
- Parties API already supports `?type=CUSTOMER|SUPPLIER` scoping (seen in `components/order-form.tsx:120`).
- `partyId` URL sync already in place from prior plan — new filter wiring must preserve compatibility.
- FilterBar renders filters in the order they appear in the `filterConfigs` array, so reorder = array reorder.

## Requirements

### Functional
1. Filter order on orders page (SALE + PURCHASE):
   1. Từ ngày–Đến ngày (`date` range)
   2. Số đơn (search, partial match, case-insensitive)
   3. Đối tác (combobox, scoped to page type)
   4. Trạng thái thanh toán (status select)
   5. Loại chi phí (expense type, **PURCHASE only**)
2. Search filter should debounce state to URL/fetch (reuse existing non-debounced pattern for simplicity — KISS; add light debounce if flicker observed).
3. Party filter preserves `partyId` from URL when arriving from party detail page.
4. API `/api/orders`: new `orderNumber` query param → Prisma `where.orderNumber.contains` (case-insensitive).

### Non-functional
- No new deps.
- Maintain current FilterBar layout (horizontal flex row).
- Parties for combobox fetched once per page-type change, cached in state.

## Architecture

```
Orders page
  fetchParties(partyTypeFor(urlType))  // on urlType change
  filterConfigs = [dateRange, search(orderNumber), select(partyId), select(status), ...expenseType(if PURCHASE)]
  fetch /api/orders?type=&partyId=&orderNumber=&status=&expenseTypeId=&dateFrom=&dateTo=
```

**partyTypeFor(urlType):**
- `SALE` → fetch `/api/parties?type=CUSTOMER` (BOTH parties also returned by existing API convention; verify)
- `PURCHASE` → fetch `/api/parties?type=SUPPLIER`
- no type (global list) → skip party filter (unusual path, current UI locks type via sidebar)

## Related Code Files

**Modify:**
- `app/api/orders/route.ts` — add `orderNumber` read + `where.orderNumber.contains` clause (case-insensitive via Prisma `mode: "insensitive"`).
- `app/(dashboard)/orders/page.tsx`:
  - Add `parties` state + load effect keyed on `urlType`.
  - Include `orderNumber` in filters state + fetch query params.
  - Reorder `filterConfigs` per spec.

**Create:** none.
**Delete:** none.

## Implementation Steps

### Step 1 — API: orderNumber search
In `app/api/orders/route.ts`:

1. Read param after existing `partyId`:
```ts
const orderNumber = searchParams.get("orderNumber");
```

2. Extend `where` clause (near line 58-65):
```ts
const where = {
  type: { in: allowedTypes },
  ...(status && { status }),
  ...(businessUnitId && { businessUnitId }),
  ...(partyId && { partyId }),
  ...(expenseTypeId && { expenseTypeId }),
  ...(orderNumber && { orderNumber: { contains: orderNumber, mode: "insensitive" as const } }),
  ...(orderDateFilter && { orderDate: orderDateFilter }),
};
```

### Step 2 — Orders page: parties state
In `app/(dashboard)/orders/page.tsx`, add after existing `expenseTypes` state:

```ts
const [parties, setParties] = useState<Array<{ id: string; name: string }>>([]);
useEffect(() => {
  if (!urlType) { setParties([]); return; }
  const partyType = urlType === "SALE" ? "CUSTOMER" : "SUPPLIER";
  fetch(`/api/parties?type=${partyType}`)
    .then((r) => r.json())
    .then((json) => { if (json.success) setParties(json.data); })
    .catch(console.error);
}, [urlType]);
```

### Step 3 — Orders page: fetch query params
Ensure `filters.orderNumber` is included in the URLSearchParams build (after `filters.partyId`):

```ts
...(filters.orderNumber ? { orderNumber: filters.orderNumber } : {}),
```

### Step 4 — Orders page: reorder filterConfigs
Replace existing `filterConfigs` array with:

```ts
const filterConfigs: FilterConfig[] = [
  { key: "date", label: "Ngày đặt", type: "date-range" },
  { key: "orderNumber", label: "Số đơn", type: "search", placeholder: "Tìm số đơn..." },
  {
    key: "partyId",
    label: "Đối tác",
    type: "select",
    options: parties.map((p) => ({ value: p.id, label: p.name })),
  },
  { key: "status", label: "Trạng thái TT", type: "select", options: STATUS_OPTIONS },
  ...(urlType === "PURCHASE"
    ? [{
        key: "expenseTypeId",
        label: "Loại chi phí",
        type: "select" as const,
        options: expenseTypes.filter((e) => e.isActive).map((e) => ({ value: e.id, label: e.name })),
      }]
    : []),
];
```

### Step 5 — Verify partyId URL sync still drives filter
Since `filters.partyId` is already synced from `urlPartyId` via existing useEffect, selecting a value in the new combobox updates `filters.partyId` via `handleFilterChange`, triggering re-fetch. URL is NOT updated on manual select (keeps implementation simple — matches other filter controls). The URL-sync is one-way: URL → filter, not filter → URL.

**Note:** The indicator bar added previously shows when user arrived via party-detail navigation. Once present, the combobox also reflects the selection. Clicking "Bỏ lọc ×" clears both URL and combobox. Acceptable UX.

### Step 6 — Compile check
Run `npx tsc --noEmit`; fix any errors.

### Step 7 — Manual test
- `/orders?type=SALE` → see 5 filters in the correct order (no expense-type column on SALE).
- Type in "Số đơn" → list narrows to matching orderNumber.
- Pick a party from combobox → list narrows to that party; indicator bar does NOT appear (only appears for URL-driven navigation).
- `/orders?type=PURCHASE` → expense-type filter visible at end; parties list switches to SUPPLIER.
- From party detail → both combobox and indicator reflect the filter.

## Todo List
- [ ] API: add `orderNumber` param + where clause
- [ ] UI: fetch parties keyed on `urlType`
- [ ] UI: include `orderNumber` in fetch query params
- [ ] UI: reorder `filterConfigs` per spec
- [ ] Type-check
- [ ] Manual test SALE + PURCHASE + party-detail nav

## Success Criteria
- Filters appear in specified order on both SALE and PURCHASE lists
- Số đơn search works with partial match, case-insensitive
- Đối tác combobox populated per page type; selecting filters list
- Existing URL-driven partyId still works
- No TS compile errors

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| Prisma `mode: "insensitive"` unsupported on target DB | Postgres (per project) supports it. Confirmed via existing Prisma usage patterns in repo |
| Large party list causes slow combobox | Combobox has typeahead; 100-500 parties acceptable. If >1000, future work = async search |
| Indicator bar + combobox double-indicate party filter | Minor UX redundancy — acceptable, both represent same state |
| URL `partyId` vs combobox drift | State is single source; URL only sets initial + soft-nav sync. Clear via indicator-bar "Bỏ lọc" resets both |

## Security Considerations
- `orderNumber` string goes into Prisma `contains` — no injection risk (parameterized).
- Party list fetch uses existing auth-protected endpoint.
- No privilege changes.

## Next Steps / Follow-ups
- If combobox perf degrades, swap to async-search combobox.
- Consider persisting all filter state in URL for shareable links (separate plan).

## Unresolved Questions
- Should selecting a party in the combobox also push to URL (so refresh preserves filter)? Current design: no. Deferred — can revisit if users report.
