# Phase 02 — Cache catalog endpoints

## Context Links
- [plan.md](./plan.md) · depends on Phase 01
- Modify: `app/api/currencies/route.ts`, `app/api/business-units/route.ts`, `app/api/expense-types/route.ts`, `app/api/parties/route.ts`

## Overview
- **Priority:** High
- **Status:** Planned
- **Brief:** Wrap catalog GETs with `withCache`. Low write rate, high read rate = highest ROI target.

## Cache key convention

| Endpoint | Key | Tag(s) | TTL |
|----------|-----|--------|-----|
| `GET /api/currencies` | `catalog:currencies` | `catalog:currencies` | 10min |
| `GET /api/business-units` | `catalog:business-units` | `catalog:business-units` | 10min |
| `GET /api/expense-types` | `catalog:expense-types` | `catalog:expense-types` | 10min |
| `GET /api/parties?type=X` | `catalog:parties:type=${type ?? "all"}` | `catalog:parties` | 5min |

Notes:
- Parties scoped by `type` param (CUSTOMER/SUPPLIER/all). Active-only filter already applied server-side.
- Per-user scoping NOT needed — these are global read-only lists with same result for all authenticated users.

## Implementation Steps

### Step 1 — Currencies route

Replace the `findMany` block in `GET`:

```ts
import { withCache } from "@/lib/cache/with-cache";

// inside GET try-block:
const data = await withCache(
  { key: "catalog:currencies", tags: ["catalog:currencies"], ttlMs: 10 * 60_000 },
  () => prisma.currency.findMany({ where: { isActive: true }, orderBy: { code: "asc" } })
);
```

### Step 2 — Business-units route
Same pattern. Key `catalog:business-units`, tag `catalog:business-units`, TTL 10min.

### Step 3 — Expense-types route
Same pattern. Key `catalog:expense-types`, tag `catalog:expense-types`, TTL 10min.

### Step 4 — Parties route
Read existing filter args. Build key from them:

```ts
const type = searchParams.get("type") ?? "all";
const data = await withCache(
  {
    key: `catalog:parties:type=${type}`,
    tags: ["catalog:parties"],
    ttlMs: 5 * 60_000,
  },
  () => prisma.party.findMany({ /* existing where */ })
);
```

**Important:** If parties endpoint supports pagination or additional filters, include them in the key. Check current impl before keying.

### Step 5 — Compile + smoke test
- `npx tsc --noEmit`
- Hit `/api/currencies` twice — second call should be instant (add `console.time` in dev to verify).

## Todo List
- [ ] Wrap currencies GET
- [ ] Wrap business-units GET
- [ ] Wrap expense-types GET
- [ ] Wrap parties GET (verify key includes all filter params)
- [ ] Type-check
- [ ] Manual latency check

## Success Criteria
- All 4 endpoints type-check clean
- Second request p50 latency < 5ms
- No behavior change for clients

## Risk Assessment
| Risk | Mitigation |
|------|-----------|
| Parties filter-param drift causing wrong key | Review parties route before keying; include all filter params in key |
| Users see stale catalog after admin updates one | Phase 04 wires invalidation on CRUD; TTL caps worst case at 10min |

## Unresolved Questions
- Does parties endpoint have additional filter args beyond `type`? Verify during impl.
