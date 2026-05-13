# Phase 05 — List Filtering by BU Access

**Effort:** 3h | **Status:** planned | **Depends on:** Phase 03

## Problem
List endpoints (orders, transactions, deposits, parties, reports) currently return all rows or filter by a user-supplied BU. Need to also intersect with the set of BUs the user has access to.

## Approach
At each list endpoint:
```ts
const accessible = accessibleBusinessUnits(session.roles, MODULE, allBuIds);
where.businessUnitId = filter.businessUnitId
  ? (accessible.includes(filter.businessUnitId) ? filter.businessUnitId : "__none__")
  : { in: accessible };
```

ADMIN gets `accessible = allBuIds`.

## Routes
- `GET /api/orders`
- `GET /api/parties`
- `GET /api/transactions`
- `GET /api/deposits`
- All `GET /api/reports/**`

## Todo
- [ ] Add filter helper in `lib/api-helpers.ts`
- [ ] Apply to each list/report endpoint
- [ ] BU dropdown in UI filters lists by `accessibleBusinessUnits` only

## Success
User with role only in TK never sees an NT row in any list or report.
