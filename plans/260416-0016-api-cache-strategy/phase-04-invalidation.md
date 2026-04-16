# Phase 04 — Invalidation wiring on mutations

## Context Links
- [plan.md](./plan.md) · depends on Phase 02 + Phase 03
- Modify: mutation handlers for currencies, business-units, expense-types, parties, orders, transactions, deposits.

## Overview
- **Priority:** Critical — incomplete invalidation = stale-data bug.
- **Status:** Planned
- **Brief:** After every POST/PATCH/PUT/DELETE that affects cached data, call `invalidateTags(...)` before returning the response.

## Invalidation matrix

| Mutation | Invalidates tags |
|----------|------------------|
| Currency create/update/delete | `catalog:currencies` + `reports:*` (all, since reports aggregate amounts in currencies — but change only affects display; can skip report invalidation for v1) |
| Business-unit create/update/delete | `catalog:business-units` |
| Expense-type create/update/delete | `catalog:expense-types` + `reports:expense-type` |
| Party create/update/delete | `catalog:parties` |
| Order create/update/delete | `reports:bu:${buId}` (all per-BU reports) |
| Transaction create/update/delete | `reports:bu:${buId}` |
| Deposit create/update/delete | `reports:bu:${buId}` (if deposits factor into dashboard/summary — verify) |
| Party updates that change `type` | `catalog:parties` + `reports:bu:${buId}` (stale party name/type in report) |

**Conservative rule:** If in doubt whether a mutation affects a cached read, invalidate the tag. Cost of invalidation (next request recomputes) is low; cost of serving stale data is high.

## Implementation Steps

### Step 1 — Enumerate mutation handlers
Grep for `export async function (POST|PATCH|PUT|DELETE)` in:
- `app/api/currencies/**/route.ts`
- `app/api/business-units/**/route.ts`
- `app/api/expense-types/**/route.ts`
- `app/api/parties/**/route.ts`
- `app/api/orders/**/route.ts`
- `app/api/transactions/**/route.ts` (+ nested `orders/[id]/transactions`)
- `app/api/parties/[id]/deposits/route.ts`

### Step 2 — Pattern

Inside the `try` block, AFTER the successful transaction / DB write, BEFORE returning the response:

```ts
import { invalidateTags } from "@/lib/cache/invalidate";

// catalog example
await prisma.currency.create({ ... });
invalidateTags(["catalog:currencies"]);

// per-BU report example
const created = await prisma.order.create({ data: { businessUnitId, ... } });
invalidateTags([`reports:bu:${businessUnitId}`]);
```

**Placement rule:** Call `invalidateTags` AFTER DB commit succeeds. Never before (a rollback would leave us with invalidated caches but unchanged DB — self-healing on next request, but wastes work). `invalidateTags` is synchronous and fast (~<1ms per tag), no await needed.

### Step 3 — Handle cross-BU moves
If any mutation can change `businessUnitId` (rare — e.g., order move), invalidate BOTH old and new BU tags:

```ts
invalidateTags([`reports:bu:${oldBuId}`, `reports:bu:${newBuId}`]);
```

Audit the orders PATCH handler for this possibility.

### Step 4 — Compile + integration test

- `npx tsc --noEmit`
- Write 1 integration test per domain (orders, parties, transactions): create → assert report reflects change on next fetch (not TTL-waited).

### Step 5 — Regression check
Run existing tests — no API contract changed, should stay green.

## Todo List
- [ ] Catalog mutations (currencies, BUs, expense-types, parties)
- [ ] Order mutations (POST + PATCH + DELETE)
- [ ] Transaction mutations (POST + PATCH + DELETE, incl. nested orders/[id]/transactions)
- [ ] Deposit mutations
- [ ] Verify cross-BU move invalidation
- [ ] Type-check
- [ ] Integration tests for invalidation paths

## Success Criteria
- Every mutation handler touching cached data calls `invalidateTags`
- Integration tests prove: mutation → next GET returns fresh data immediately (not waiting TTL)
- No dangling `invalidateTags` call in paths that rolled back

## Risk Assessment
| Risk | Mitigation |
|------|-----------|
| Missed invalidation on new mutation endpoints | Code-review checklist: "Does this mutation affect any cached GET? If yes, invalidate tag." Add ESLint rule / custom grep check in CI (future) |
| Bulk operations invalidating repeatedly | Batch: call `invalidateTags` ONCE after loop, not per-iteration |
| Invalidation firing inside failed `$transaction` | Place call AFTER `await prisma.$transaction(...)` returns successfully |

## Unresolved Questions
- Do deposits factor into dashboard/summary aggregates? Verify by reading deposit mutation handlers + report query logic. If yes, invalidate `reports:bu:${buId}` on deposit mutations.
- Should currency rename trigger report invalidation? (Only display labels change, numbers unchanged.) Default: invalidate — safer.
