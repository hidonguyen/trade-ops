---
title: Extend cache to remaining CRUD resources (entity detail + per-entity lists)
created: 2026-04-16
status: completed
mode: fast
blockedBy: []
blocks: []
related: [260416-0016-api-cache-strategy]
---

# Extend Cache Coverage

## Problem

Prior plan (`260416-0016-api-cache-strategy`) wrapped catalog endpoints + 3 report endpoints. Remaining CRUD resources are uncached. This plan covers the high-ROI subset and explicitly declines the low-ROI ones.

## Audit of uncached endpoints (via grep `withCache|invalidateTags`)

| Endpoint | Decision | Reason |
|----------|----------|--------|
| `GET /api/users` | **Cache** | Small, stable list (ADMIN-only) |
| `GET /api/users/[id]` | **Cache** | Rare, simple key-by-id |
| `PATCH/DELETE /api/users/[id]` | Invalidate | — |
| `POST /api/users` | Invalidate | — |
| `GET /api/orders/[id]` | **Cache** | Frequently opened (detail page + edit), nontrivial query |
| `GET /api/parties/[id]` | **Cache** | Detail page repeat-opens |
| `GET /api/parties/[id]/deposits` | **Cache** | Shown on every party detail load |
| `POST /api/parties/[id]/deposits` | Invalidate | — |
| `GET /api/orders/[id]/transactions` | **Cache** | Per-order tx list, stable until mutation |
| `GET /api/orders/[id]/report` | **Cache** | Aggregated per-order report (compute-heavy) |
| `GET /api/audit-logs` | **Skip** | Append-only, filter explosion, users need fresh data |
| `GET /api/orders` (list) | **Skip** | Many filter combos + frequent mutations |
| `GET /api/transactions` (list) | **Skip** | Same reasons |
| `GET /api/reports/bank-fees` | **Skip** | xlsx/JSON branching; deferred (prior plan) |
| `GET /api/cashflow-report` | **Skip** | xlsx/JSON branching; deferred |
| `GET /api/admin/cache-stats` | **Skip** | Meta/admin — always fresh |
| `GET /api/auth/*` | **Skip** | Auth — security-sensitive |

## Scope

Single phase. ~7 GET handlers wrapped, ~7 mutation handlers get invalidation hooks.

## Phases

- [x] Phase 01 — Extend keys helper + wrap detail GETs + wire invalidation → [phase-01-extend-cache-coverage.md](./phase-01-extend-cache-coverage.md)

## New tags + key patterns

Add to `lib/cache/keys.ts`:

```ts
export const TAG = {
  ...,
  users: "catalog:users",                               // users list tag
  user: (id: string) => `user:${id}`,                    // per-user
  order: (id: string) => `order:${id}`,                  // per-order (detail + nested)
  party: (id: string) => `party:${id}`,                  // per-party (detail)
  partyDeposits: (id: string) => `party:${id}:deposits`,
} as const;

export function userKey(id: string) { return `user:${id}`; }
export function usersListKey(query: string) { return `users:list:${query}`; }
export function orderKey(id: string) { return `order:${id}`; }
export function orderTxListKey(orderId: string, query: string) { return `order:${orderId}:tx:${query}`; }
export function orderReportKey(orderId: string) { return `order:${orderId}:report`; }
export function partyKey(id: string) { return `party:${id}`; }
export function partyDepositsKey(partyId: string, query: string) { return `party:${partyId}:deposits:${query}`; }
```

## Invalidation rules

| Mutation | Invalidates |
|----------|-------------|
| User POST | `TAG.users` |
| User PATCH/DELETE | `TAG.users`, `TAG.user(id)` |
| Order PATCH | `TAG.order(id)`, `TAG.reportsByBu(buId)` (already done), per-order report tag implicitly via `order:{id}` |
| Party PATCH/DELETE | `TAG.party(id)`, existing invalidations |
| Party POST | `TAG.parties` (existing) |
| Deposit POST | `TAG.partyDeposits(partyId)`, `TAG.reportsByBu(buId)` (because deposits factor into dashboard) |
| Transaction POST/PATCH/DELETE (order-nested) | additionally `TAG.order(orderId)` (order.paidAmount/refundedAmount change) |
| Transaction POST/PATCH/DELETE (standalone or order-nested, if deposit-funded) | `TAG.partyDeposits(partyId)` |

TTLs:
- Users list/detail: 5min (small, stable)
- Order detail / per-order tx list: 30s (tx mutations frequent)
- Order report: 60s (aggregated)
- Party detail: 2min (rarely edited)
- Party deposits: 60s (deposits can be added anytime)

## Key Files

**Modify:**
- `lib/cache/keys.ts` — add new keys/tags
- `app/api/users/route.ts` (GET + POST)
- `app/api/users/[id]/route.ts` (GET + PATCH + DELETE)
- `app/api/parties/[id]/route.ts` (GET; PATCH/DELETE already invalidate)
- `app/api/parties/[id]/deposits/route.ts` (GET + POST)
- `app/api/orders/[id]/route.ts` (GET; PATCH already invalidates)
- `app/api/orders/[id]/transactions/route.ts` (GET; POST already invalidates — add order-tag)
- `app/api/orders/[id]/transactions/[txId]/route.ts` (PATCH/DELETE already invalidate — add order-tag)
- `app/api/orders/[id]/report/route.ts` (GET)
- `app/api/transactions/route.ts` (POST) — add deposit/partyDeposits invalidation if depositId present
- `app/api/transactions/[id]/route.ts` (PATCH/DELETE) — add deposit invalidation if depositId

**No new files.**

## Success Criteria

- All listed GETs cache-hit within 5ms on second call
- `tsc --noEmit` clean
- After any mutation, next GET for that entity returns fresh data
- `/api/admin/cache-stats` shows elevated hit-ratio under realistic usage
- No cross-user/cross-BU cache leakage

## Non-Goals

- Caching `orders`/`transactions`/`audit-logs` list pages (keyspace + mutation frequency)
- xlsx export endpoints (deferred)

## Risks

| Risk | Mitigation |
|------|-----------|
| Order transactions list cache diverges from DB after a related mutation in a different session | Short 30s TTL + tag-invalidate on every relevant mutation path |
| Deposits list stale after a deposit-consuming transaction | Invalidate `partyDeposits` tag whenever a transaction references a deposit |
| Per-id tags proliferate (memory) | LRU cap (500) self-limits; monitor via stats endpoint |

## Unresolved Questions

- Should `users/[id]` GET expose soft-deleted users? (doesn't affect caching design) — existing route decides
- Does `orders/[id]` detail include fresh transaction list? If yes, invalidating `order:{id}` on any tx mutation is critical (confirmed in plan)
