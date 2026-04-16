# Phase 01 — Party detail order buttons + orders page partyId filter

## Context Links
- [plan.md](./plan.md)
- `app/(dashboard)/parties/[id]/page.tsx`
- `app/(dashboard)/orders/page.tsx`
- `app/api/orders/route.ts` (already supports `partyId`, no change)

## Overview
- **Priority:** High (user-facing bug + UX improvement)
- **Status:** Planned
- **Brief:** Split generic "Xem đơn hàng" into type-specific buttons based on party type. Fix orders page to respect `partyId` URL param.

## Key Insights

- Orders API already supports `partyId` filter (`app/api/orders/route.ts:26,62`). Bug is UI-only.
- `partyId` in URL is currently ignored by `app/(dashboard)/orders/page.tsx` — not read into filter state, not passed to fetch.
- Party type values: `CUSTOMER` | `SUPPLIER` | `BOTH` (confirmed in existing page `TYPE_LABELS` map).
- Sidebar `type` sync already handled for `SALE`/`PURCHASE`; `partyId` needs parallel treatment.

## Requirements

### Functional
1. Party detail page renders buttons by type:
   - `CUSTOMER` → single "Xem đơn bán" → `/orders?type=SALE&partyId={id}`
   - `SUPPLIER` → single "Xem đơn mua" → `/orders?type=PURCHASE&partyId={id}`
   - `BOTH` → two buttons side-by-side: "Xem đơn bán" + "Xem đơn mua" with respective URLs
2. Orders page reads `partyId` from URL, includes in fetch request.
3. Orders page shows indicator (party name) when filtered by party + clear-filter affordance.
4. Changing URL `partyId` re-filters (soft navigation support).

### Non-functional
- No API changes.
- No new deps.
- Consistent with existing `type` URL-sync pattern.

## Architecture

**Data flow (after fix):**
```
Party Detail page
  [Xem đơn bán] → router.push(`/orders?type=SALE&partyId=${id}`)
Orders page
  useSearchParams() → reads type + partyId
  filters state merges URL params
  fetchOrders() includes both in /api/orders query
  Header shows "Đơn bán — Lọc theo: {party.name} [×]"
```

## Related Code Files

**Modify:**
- `app/(dashboard)/parties/[id]/page.tsx` (around lines 119-122): replace single button with conditional rendering based on `party.type`.
- `app/(dashboard)/orders/page.tsx`:
  - Lines 46-60: extend initial state + URL-sync effect to include `partyId`.
  - Lines 62-86: include `partyId` in fetch query string.
  - Add party-name fetch (when `partyId` present, GET `/api/parties/{id}` to show name) — small useEffect.
  - Render indicator bar showing filtered party + clear button that routes to `/orders?type={urlType}`.

**Create:** none.
**Delete:** none.

## Implementation Steps

### Step 1 — Party detail buttons
In `app/(dashboard)/parties/[id]/page.tsx`, replace the single "Xem đơn hàng" Button (~line 120) with:

```tsx
{(party.type === "CUSTOMER" || party.type === "BOTH") && (
  <Button variant="outline" size="sm"
    onClick={() => router.push(`/orders?type=SALE&partyId=${partyId}`)}>
    <ShoppingBagIcon className="size-4 mr-1" />Xem đơn bán
  </Button>
)}
{(party.type === "SUPPLIER" || party.type === "BOTH") && (
  <Button variant="outline" size="sm"
    onClick={() => router.push(`/orders?type=PURCHASE&partyId=${partyId}`)}>
    <ShoppingBagIcon className="size-4 mr-1" />Xem đơn mua
  </Button>
)}
```

### Step 2 — Orders page reads partyId
In `app/(dashboard)/orders/page.tsx`:

1. Extend initial filter state (line 46-49):
```tsx
const [filters, setFilters] = useState<Record<string, string>>(() => {
  const type = searchParams.get("type");
  const partyId = searchParams.get("partyId");
  return { ...(type && { type }), ...(partyId && { partyId }) };
});
```

2. Extend URL-sync effect (line 52-60) to also sync `partyId`:
```tsx
const urlType = searchParams.get("type");
const urlPartyId = searchParams.get("partyId");
useEffect(() => {
  setFilters((prev) => {
    const next = { ...prev };
    if (urlType) next.type = urlType; else delete next.type;
    if (urlPartyId) next.partyId = urlPartyId; else delete next.partyId;
    return next;
  });
  setPage(1);
}, [urlType, urlPartyId]);
```

3. Include `partyId` in fetch params (line 65-74):
```tsx
...(filters.partyId ? { partyId: filters.partyId } : {}),
```

### Step 3 — Show party filter indicator
Fetch party name when `urlPartyId` present; render a chip/banner above FilterBar:

```tsx
const [filteredParty, setFilteredParty] = useState<{ name: string } | null>(null);
useEffect(() => {
  if (!urlPartyId) { setFilteredParty(null); return; }
  fetch(`/api/parties/${urlPartyId}`)
    .then(r => r.json())
    .then(json => { if (json.success) setFilteredParty({ name: json.data.name }); })
    .catch(() => setFilteredParty(null));
}, [urlPartyId]);
```

Render above FilterBar:
```tsx
{filteredParty && (
  <div className="flex items-center gap-2 text-sm bg-blue-50 border border-blue-200 rounded px-3 py-2">
    <span className="text-slate-700">Đang lọc theo đối tác: <strong>{filteredParty.name}</strong></span>
    <button type="button"
      onClick={() => router.push(urlType ? `/orders?type=${urlType}` : "/orders")}
      className="ml-auto text-blue-600 hover:text-blue-800 text-xs">
      Bỏ lọc ×
    </button>
  </div>
)}
```

### Step 4 — Compile check
Run `npx tsc --noEmit` (or project's existing type-check script) to confirm no TS errors.

## Todo List
- [ ] Update party detail page button rendering by type
- [ ] Extend orders page initial filter state with partyId
- [ ] Extend orders page URL-sync effect for partyId
- [ ] Include partyId in fetchOrders query params
- [ ] Add filtered-party fetch + indicator bar with clear action
- [ ] Run type-check; fix any errors
- [ ] Manual test: CUSTOMER/SUPPLIER/BOTH party → click buttons → verify filter works

## Success Criteria
- CUSTOMER party detail shows only "Xem đơn bán"
- SUPPLIER party detail shows only "Xem đơn mua"
- BOTH party detail shows both buttons
- Clicking either button lands on `/orders` page with correct `type` AND `partyId` applied to list
- API call in network tab includes `partyId` query param
- Indicator bar visible with party name + working clear-filter action
- No TS compile errors

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| BOTH parties break back-button logic | Existing `?from=` already handles this; unchanged |
| URL-sync effect creates render loop | Guard with conditional (only setFilters when value actually differs) — existing pattern preserved |
| Party name fetch fails silently | Safe — falls back to no indicator; filter still active |

## Security Considerations
- `partyId` is read from URL but only used in API query. API applies standard auth (`withAuth` + `checkAccess`), so no privilege escalation.
- No XSS risk — values passed through React children escaping.

## Next Steps / Follow-ups
- Consider adding "Xem đơn" button to party rows in parties list page (out of scope for this phase).

## Unresolved Questions
- None.
