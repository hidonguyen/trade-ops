# Phase 05 — Observability + Redis upgrade path

## Context Links
- [plan.md](./plan.md) · depends on Phase 01
- New: `app/api/admin/cache-stats/route.ts`
- Docs: update `docs/system-architecture.md` with cache layer

## Overview
- **Priority:** Medium (quality-of-life + future-proofing)
- **Status:** Planned
- **Brief:** Expose cache stats for admins, add clear-cache control, document swap path to Redis.

## Requirements

1. `GET /api/admin/cache-stats` (ADMIN only) returns `{ enabled, size, hits, misses, hitRatio, tagCount }`.
2. `POST /api/admin/cache-stats?action=clear` (ADMIN only) flushes the entire cache. Useful during incidents.
3. Document `RedisCacheStore` stub — NOT implemented now, but interface-ready. Single file to add when needed.
4. Update `docs/system-architecture.md` with a short "Caching" section.

## Implementation Steps

### Step 1 — Admin stats endpoint

`app/api/admin/cache-stats/route.ts`:

```ts
import { withAuth, checkAccess, apiResponse } from "@/lib/api-helpers";
import { cacheStore, cacheEnabled } from "@/lib/cache";
import { MSG } from "@/lib/messages";

export async function GET() {
  const session = await withAuth();
  if (!session) return Response.json(apiResponse(false, undefined, MSG.unauthorized), { status: 401 });
  if (!checkAccess(session.user.roles, "GET", "ADMIN"))
    return Response.json(apiResponse(false, undefined, MSG.accessDenied), { status: 403 });

  const s = cacheStore.stats();
  const hitRatio = s.hits + s.misses === 0 ? 0 : s.hits / (s.hits + s.misses);
  return Response.json(apiResponse(true, { enabled: cacheEnabled, ...s, hitRatio }));
}

export async function POST(request: Request) {
  const session = await withAuth();
  if (!session) return Response.json(apiResponse(false, undefined, MSG.unauthorized), { status: 401 });
  if (!checkAccess(session.user.roles, "DELETE", "ADMIN"))
    return Response.json(apiResponse(false, undefined, MSG.accessDenied), { status: 403 });

  const { searchParams } = new URL(request.url);
  if (searchParams.get("action") === "clear") {
    cacheStore.clear();
    return Response.json(apiResponse(true, { cleared: true }));
  }
  return Response.json(apiResponse(false, undefined, "Unknown action"), { status: 400 });
}
```

### Step 2 — Redis stub (docs + scaffolding only)

Add `lib/cache/redis-cache-store.ts.example` (note `.example` — not wired in):

```ts
// ACTIVATE WHEN SCALING TO MULTI-REPLICA.
// Steps:
// 1. npm install ioredis
// 2. Rename this file to redis-cache-store.ts
// 3. Set process.env.REDIS_URL
// 4. In lib/cache/index.ts, select RedisCacheStore when process.env.CACHE_DRIVER === "redis"
//
// Implementation skeleton: use Redis hash per tag (tag -> set of keys),
// plain GET/SET with EX for values. deleteByTag = SMEMBERS tag → DEL keys → DEL tag.
```

### Step 3 — Env toggle in `lib/cache/index.ts`

Optional minor edit to prepare driver switch:

```ts
const driver = process.env.CACHE_DRIVER ?? "lru";
export const cacheStore: CacheStore =
  driver === "lru" ? new LruCacheStore() : (() => { throw new Error(`Unknown CACHE_DRIVER: ${driver}`); })();
```

### Step 4 — Docs update

Append to `docs/system-architecture.md`:

```md
## Caching

In-process LRU cache with tag-based invalidation. Default: 500 entries, 5min TTL, configurable per call.

- **What's cached:** catalog GETs (currencies, BUs, expense-types, parties) + report aggregations (dashboard, summary, bank-fees, expense-type-summary, cashflow).
- **Not cached:** order/transaction lists, entity details, audit logs, auth.
- **Invalidation:** mutations call `invalidateTags(...)`. 60s-10min TTL caps worst-case staleness.
- **Toggle:** `CACHE_ENABLED=false` for debugging.
- **Stats:** `GET /api/admin/cache-stats` (ADMIN).
- **Upgrade path:** `lib/cache/redis-cache-store.ts.example` → rename + set `CACHE_DRIVER=redis`, `REDIS_URL=...` when scaling to multiple replicas.
```

### Step 5 — Compile + smoke

`npx tsc --noEmit` → hit `/api/admin/cache-stats` as ADMIN after some traffic, verify hit-ratio > 0.

## Todo List
- [ ] Implement `/api/admin/cache-stats` GET + POST
- [ ] Add `redis-cache-store.ts.example` stub
- [ ] Update `lib/cache/index.ts` to honor `CACHE_DRIVER` env
- [ ] Update `docs/system-architecture.md`
- [ ] Type-check

## Success Criteria
- As ADMIN, `/api/admin/cache-stats` returns valid stats payload
- POST `?action=clear` empties the cache and subsequent GETs rebuild it
- Non-ADMIN gets 403
- Docs describe the cache + upgrade path

## Risk Assessment
| Risk | Mitigation |
|------|-----------|
| Exposing cache internals (keys) via stats | Return aggregates only, never raw keys |
| Clear-all action during traffic spike causes DB stampede | Documented as emergency tool; future: per-tag clear flag |

## Unresolved Questions
- Do we want per-tag clear now, or defer to when needed?
