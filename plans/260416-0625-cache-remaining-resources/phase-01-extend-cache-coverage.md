# Phase 01 — Extend cache coverage to remaining CRUD resources

## Context Links
- [plan.md](./plan.md)
- Prior plan: `plans/260416-0016-api-cache-strategy/`
- `lib/cache/keys.ts`, `lib/cache/with-cache.ts`, `lib/cache/invalidate.ts`

## Overview
- **Priority:** Medium
- **Status:** Planned
- **Brief:** Wrap 7 uncached GET endpoints (entity detail + per-entity lists) and wire matching invalidation.

## Implementation Steps

### Step 1 — Extend `lib/cache/keys.ts`

Add to existing `TAG` object and export new key builders:

```ts
export const TAG = {
  // ...existing...
  users: "catalog:users",
  user: (id: string) => `user:${id}`,
  order: (id: string) => `order:${id}`,
  party: (id: string) => `party:${id}`,
  partyDeposits: (partyId: string) => `party:${partyId}:deposits`,
} as const;

export const TTL = {
  // ...existing...
  userList: 5 * 60_000,
  userDetail: 5 * 60_000,
  orderDetail: 30_000,
  orderTxList: 30_000,
  orderReport: 60_000,
  partyDetail: 2 * 60_000,
  partyDeposits: 60_000,
} as const;

export function usersListKey(query: string) { return `users:list:${query}`; }
export function userKey(id: string) { return `user:${id}`; }
export function orderDetailKey(id: string) { return `order:${id}:detail`; }
export function orderTxListKey(orderId: string, query: string) { return `order:${orderId}:tx:${query}`; }
export function orderReportKey(orderId: string) { return `order:${orderId}:report`; }
export function partyDetailKey(id: string) { return `party:${id}:detail`; }
export function partyDepositsKey(partyId: string, query: string) { return `party:${partyId}:deposits:${query}`; }
```

### Step 2 — Users list + detail

**`app/api/users/route.ts` GET:** wrap with key built from all query params; tag `TAG.users`.

```ts
const querySig = `${searchParams.toString()}`;
const data = await withCache(
  { key: usersListKey(querySig), tags: [TAG.users], ttlMs: TTL.userList },
  () => prisma.user.findMany({ /* ...existing... */ })
);
```

**POST:** after commit, `invalidateTags([TAG.users])`.

**`app/api/users/[id]/route.ts`:**
- GET: `withCache({ key: userKey(id), tags: [TAG.users, TAG.user(id)], ttlMs: TTL.userDetail }, ...)`
- PATCH: `invalidateTags([TAG.users, TAG.user(id)])`
- DELETE: same as PATCH

### Step 3 — Order detail + nested tx list + report

**`app/api/orders/[id]/route.ts` GET:**

```ts
const order = await withCache(
  { key: orderDetailKey(id), tags: [TAG.order(id)], ttlMs: TTL.orderDetail },
  () => prisma.order.findFirst({ /* ...existing... */ })
);
```

**PATCH:** add `TAG.order(id)` to existing invalidation call:
```ts
invalidateTags([TAG.reportsByBu(result.businessUnitId), TAG.order(id)]);
```

**`app/api/orders/[id]/transactions/route.ts`:**
- GET: `withCache({ key: orderTxListKey(id, searchParams.toString()), tags: [TAG.order(id)], ttlMs: TTL.orderTxList }, ...)`
- POST: add `TAG.order(id)` to existing invalidation (so order detail + tx list flush on new tx)

**`app/api/orders/[id]/transactions/[txId]/route.ts`:**
- PATCH/DELETE: add `TAG.order(orderId)` to existing invalidation

**`app/api/orders/[id]/report/route.ts` GET:**
```ts
const report = await withCache(
  { key: orderReportKey(id), tags: [TAG.order(id)], ttlMs: TTL.orderReport },
  async () => { /* ...existing aggregation... */ }
);
```
Same `TAG.order(id)` tag means any order/tx mutation for that order invalidates the report.

### Step 4 — Party detail + deposits

**`app/api/parties/[id]/route.ts`:**
- GET: `withCache({ key: partyDetailKey(id), tags: [TAG.party(id)], ttlMs: TTL.partyDetail }, ...)`
- PATCH/DELETE: add `TAG.party(id)` to existing invalidation

**`app/api/parties/[id]/deposits/route.ts`:**
- GET: `withCache({ key: partyDepositsKey(partyId, searchParams.toString()), tags: [TAG.partyDeposits(partyId)], ttlMs: TTL.partyDeposits }, ...)`
- POST: after commit, `invalidateTags([TAG.partyDeposits(partyId), TAG.reportsByBu(businessUnitId)])`

### Step 5 — Transaction mutations touching deposits

In `app/api/transactions/route.ts` POST + `app/api/transactions/[id]/route.ts` PATCH/DELETE:
- If `depositId` present (deposit-funded transaction), additionally invalidate `TAG.partyDeposits(partyId)`.
- Need to resolve `partyId` from either the transaction/order linkage or the deposit.

Pattern:
```ts
// after commit
const invalidates = [TAG.reportsByBu(result.businessUnitId)];
if (result.depositId && result.partyId) invalidates.push(TAG.partyDeposits(result.partyId));
invalidateTags(invalidates);
```

For order-nested transactions, also add `TAG.order(orderId)`.

### Step 6 — Compile + smoke

```bash
npx tsc --noEmit
```

Smoke: open a party detail page twice → second call fast. Edit the party → refresh → fresh data. Add a transaction using a deposit → deposits list reflects new balance.

## Todo List
- [ ] Extend `lib/cache/keys.ts`
- [ ] Users list + detail cache + invalidation
- [ ] Order detail cache + extend PATCH invalidation
- [ ] Order tx list cache + extend tx mutation invalidation
- [ ] Order report cache
- [ ] Party detail cache + extend PATCH/DELETE invalidation
- [ ] Party deposits cache + POST invalidation
- [ ] Transaction mutation: add partyDeposits tag when depositId present
- [ ] Order-nested transaction mutations: add `TAG.order(orderId)`
- [ ] Type-check
- [ ] Update `docs/system-architecture.md` cache table with new entries

## Success Criteria

- 7 GETs wrapped in `withCache`
- All corresponding mutation handlers call `invalidateTags` with correct tags
- `tsc --noEmit` clean
- Smoke: cache-hit on repeated reads; mutation → immediate fresh read
- Docs updated

## Risks

| Risk | Mitigation |
|------|-----------|
| Nested tx mutation forgets to invalidate `order:{id}` → stale order detail/report | Add `TAG.order(orderId)` in every order-nested tx path (POST/PATCH/DELETE) — listed in step 3 |
| Transaction PATCH changes depositId → old deposit stale | Invalidate both old + new partyDeposits tags if depositId changed |
| Per-id tag proliferation | LRU cap (500 entries) + stats monitoring |

## Unresolved Questions

- Does `users` GET support search/pagination params that would explode keyspace? Verify and key accordingly.
- Any other handlers that create/consume deposits besides transactions? (deposit-deduction-service usage — check.)
