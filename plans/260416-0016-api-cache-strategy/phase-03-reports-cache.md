# Phase 03 — Cache report endpoints

## Context Links
- [plan.md](./plan.md) · depends on Phase 01
- Modify: `app/api/reports/dashboard/route.ts`, `app/api/reports/summary/route.ts`, `app/api/reports/bank-fees/route.ts`, `app/api/reports/expense-type-summary/route.ts`, `app/api/cashflow-report/route.ts`

## Overview
- **Priority:** Medium-High (biggest latency win when cache hits)
- **Status:** Planned
- **Brief:** Cache aggregation-heavy report GETs. Shorter TTL (60s) since users expect fresher data than catalogs.

## Cache key convention

All report keys include `bu=${businessUnitId}` + relevant date range. Per-BU scoping is critical (users shouldn't see another BU's aggregates).

| Endpoint | Key pattern | Tag(s) | TTL |
|----------|-------------|--------|-----|
| `/api/reports/dashboard` | `reports:dashboard:bu=${buId}` | `reports:bu:${buId}`, `reports:dashboard` | 60s |
| `/api/reports/summary` | `reports:summary:bu=${buId}:from=${f}:to=${t}` | `reports:bu:${buId}`, `reports:summary` | 60s |
| `/api/reports/bank-fees` | `reports:bank-fees:bu=${buId}:from=${f}:to=${t}` | `reports:bu:${buId}`, `reports:bank-fees` | 60s |
| `/api/reports/expense-type-summary` | `reports:expense-type:bu=${buId}:from=${f}:to=${t}` | `reports:bu:${buId}`, `reports:expense-type` | 60s |
| `/api/cashflow-report` | `reports:cashflow:bu=${buId}:from=${f}:to=${t}` | `reports:bu:${buId}`, `reports:cashflow` | 60s |

**Design choice — short TTL + tag invalidation:**
- 60s TTL means even without perfect invalidation, users see fresh data quickly.
- Tag `reports:bu:${buId}` invalidates ALL reports for that BU on any transactional mutation in that BU (coarse but correct).
- Per-report tags (`reports:summary`, etc.) enable narrower targeting if ever needed.

**NOT cached:**
- Responses when required filter params are missing or invalid (let the handler return an error uncached).
- Per-user filters if present (currently no reports have these — all BU-scoped).

## Implementation Steps

### Step 1 — Extract a small helper for key derivation

`lib/cache/keys.ts`:

```ts
export function reportKey(
  type: "dashboard" | "summary" | "bank-fees" | "expense-type" | "cashflow",
  parts: { buId: string; from?: string; to?: string }
) {
  const base = `reports:${type}:bu=${parts.buId}`;
  return parts.from && parts.to ? `${base}:from=${parts.from}:to=${parts.to}` : base;
}

export function reportTags(type: string, buId: string): string[] {
  return [`reports:bu:${buId}`, `reports:${type}`];
}
```

### Step 2 — Wrap each report route

Pattern (example for `reports/summary`):

```ts
import { withCache } from "@/lib/cache/with-cache";
import { reportKey, reportTags } from "@/lib/cache/keys";

// Inside GET, after validating buId/dateFrom/dateTo:
const data = await withCache(
  {
    key: reportKey("summary", { buId: businessUnitId, from: dateFrom, to: dateTo }),
    tags: reportTags("summary", businessUnitId),
    ttlMs: 60_000,
  },
  async () => {
    // existing aggregation logic moved inside fetcher
    // ...
    return result;
  }
);
return Response.json(apiResponse(true, data));
```

Apply same pattern to all 5 report routes.

### Step 3 — Compile + verify

- `npx tsc --noEmit`
- Hit `/api/reports/summary?...` twice — second call should return in <5ms (add timing log in dev).

## Todo List
- [ ] Create `lib/cache/keys.ts` helper
- [ ] Wrap `reports/dashboard`
- [ ] Wrap `reports/summary`
- [ ] Wrap `reports/bank-fees`
- [ ] Wrap `reports/expense-type-summary`
- [ ] Wrap `cashflow-report`
- [ ] Type-check
- [ ] Manual latency check

## Success Criteria
- All 5 routes type-check clean
- Second request on same params returns cached in <5ms
- Different `buId` returns a distinct cache entry (verify via stats endpoint from Phase 05)

## Risk Assessment
| Risk | Mitigation |
|------|-----------|
| CSV/Excel export routes also caching-sensitive | Only cache JSON paths; exports always compute fresh |
| Big aggregation results bloat cache | LRU size cap (500 entries) + per-entry size small (JSON) |
| Date-range keyspace explosion | 60s TTL + LRU eviction bounds total memory |

## Unresolved Questions
- `reports/bank-fees` has both JSON fetch and Excel download (`window.open`). Verify the Excel download path isn't also cached (should route around cache or return uncached).
