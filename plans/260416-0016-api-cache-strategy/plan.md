---
title: API caching strategy — what to cache + invalidation
created: 2026-04-16
status: completed
mode: hard
blockedBy: []
blocks: []
---

# API Caching Strategy

## Problem

API has ~25 routes. Some are hot (dashboards, catalogs) and re-fetched frequently without changing often. No cache layer exists. Goal: reduce DB load + latency for read-heavy endpoints while keeping data fresh on mutations.

## Context (Pre-plan research findings)

**Stack:** Next.js 16 App Router + Prisma 7 + Postgres. Deploy: Docker (self-hosted).

**API surface (25 routes) — classified by cacheability:**

| Category | Endpoints | Staleness tolerance | Cache? | Rationale |
|----------|-----------|---------------------|--------|-----------|
| **Settings/Catalogs** (slow-changing, high-read) | currencies, business-units, expense-types, parties list | minutes–hours | **YES — high ROI** | Few writes/day, read on every page load |
| **Reports** (compute-heavy, often re-opened) | reports/dashboard, reports/summary, reports/bank-fees, reports/expense-type-summary, cashflow-report | 30–120s | **YES — medium ROI** | Multiple aggregations per request; same user may reload repeatedly |
| **Transactional lists** (frequently mutated) | orders, transactions, audit-logs, deposits | seconds | **NO** | Filter combinations explode keyspace; invalidation complexity > benefit |
| **Entity detail** | orders/[id], parties/[id], etc. | seconds | **NO (initially)** | Dynamic, low repeat-reads in session |
| **Auth** | auth/* | n/a | **NO** | Security-sensitive |

**Cache layer choice:**
- **Start with in-process LRU** (lib `lru-cache`, ~3KB, zero infra). Fits single-container dev/staging/prod-low-scale.
- **Upgrade path: Redis** (Upstash or self-hosted) when scaling to multi-replica. Abstract behind a small `cache-store` interface so swapping is a one-file change.
- **Rejected: Next.js `unstable_cache`** — non-trivial issues with self-hosted in Next 16 (varies per release), ties us to Next internals, harder to reason about invalidation when mutating via Prisma (no fetch involvement).

**Invalidation strategy:**
- **Tag-based** — each cache entry carries one or more tags (`"currencies"`, `"party:{id}"`, `"reports:bu:{buId}"`).
- **Explicit invalidation on mutation** — POST/PATCH/PUT/DELETE routes call `cache.invalidateTag(...)` before returning.
- **TTL fallback** — reports = 60s, catalogs = 10min. Limits worst-case staleness if a mutation path misses invalidation.
- **Per-user keying** where relevant — never cross-user leakage.
- **No cache on write paths** (POST/PATCH/DELETE only read for returned entity, not re-cached).

## Phases

- [x] Phase 01 — Cache library + core abstractions → [phase-01-cache-core.md](./phase-01-cache-core.md)
- [x] Phase 02 — Wrap catalog endpoints (currencies, business-units, expense-types, parties) → [phase-02-catalog-cache.md](./phase-02-catalog-cache.md)
- [x] Phase 03 — Wrap report endpoints (dashboard, summary, expense-type-summary) → [phase-03-reports-cache.md](./phase-03-reports-cache.md)
- [x] Phase 04 — Invalidation wiring on mutations → [phase-04-invalidation.md](./phase-04-invalidation.md)
- [x] Phase 05 — Observability + upgrade-to-Redis path → [phase-05-observability-redis-path.md](./phase-05-observability-redis-path.md)

**Deferred:** bank-fees + cashflow-report caching — both have xlsx-export branching that complicates cache keys; moderate benefit since these pages open less frequently. Plan to revisit if traffic warrants.

## Key Files

**New:**
- `lib/cache/cache-store.ts` — interface + LRU implementation
- `lib/cache/tag-index.ts` — tag-to-key index for invalidation
- `lib/cache/with-cache.ts` — thin wrapper `withCache({ key, tags, ttl, fetch })`
- `lib/cache/invalidate.ts` — `invalidateTags(tags: string[])` helper

**Modify:**
- 4 catalog GET routes
- 4 report GET routes
- ~12 mutation routes (POST/PATCH/DELETE for party, order, transaction, deposit, catalog CRUD) to call `invalidateTags`

## Success Criteria

- Catalog endpoints return from cache within 1ms p50 (vs ~20-50ms DB query)
- Reports return from cache within 1ms p50 (vs ~100-500ms aggregation)
- After any mutation, next GET returns fresh data (verified by integration test)
- Zero cross-user/cross-BU leakage (unit tests for key derivation)
- Hit-ratio metric exposed via `/api/admin/cache-stats` (ADMIN only)
- Disable via env `CACHE_ENABLED=false` for local debugging

## Non-Goals (YAGNI)

- Full Redis deploy now (interface-ready, but LRU is default)
- Distributed invalidation (single-replica assumption for now)
- HTTP `Cache-Control` headers (out-of-scope; server-side only)
- Caching mutations or write-through patterns

## Risks

| Risk | Mitigation |
|------|-----------|
| Stale data after missed invalidation | TTL cap (60s–10min) limits worst case |
| Memory bloat | LRU max-entries cap (e.g., 500 keys, ~5MB) |
| Multi-replica deploy → inconsistent caches | Documented upgrade path; toggle in Phase 05 swaps LRU→Redis via same interface |
| Leaking another user's data | Per-user key prefix when session-scoped; strict key-builder helpers |

## Unresolved Questions

- Multi-replica deployment timeline? (determines Phase 05 urgency)
- Are reports viewed concurrently by many users, or mostly solo admins? (affects expected hit-ratio)
