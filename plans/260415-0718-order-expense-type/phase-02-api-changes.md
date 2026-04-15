# Phase 02 — API: CRUD + filter + new summary report

## Overview
- Priority: High
- Status: pending
- Depends on: Phase 01

## Validation (`lib/validation-schemas.ts`)

Extend `createOrderSchema`:

```ts
expenseTypeId: z.string().uuid().optional().nullable(),
```

Refinement: if `type === "SALE"` and `expenseTypeId` provided → reject (400). Prevents accidental contamination.

Also extend `updateOrderSchema` (in `app/api/orders/[id]/route.ts`) to allow patching `expenseTypeId` when order has no transactions OR keep always-editable (safer — it's descriptive metadata, not financial). Decision: always editable.

## Order routes

- `app/api/orders/route.ts`
  - POST: accept + persist `expenseTypeId`.
  - GET: add filter `?expenseTypeId=<id>`; include `expenseType: { select: { id, name } }` in response.
- `app/api/orders/[id]/route.ts`
  - GET: include `expenseType` in `orderIncludes`.
  - PATCH: allow `expenseTypeId` update (always editable).

## New summary report

Create `app/api/reports/expense-type-summary/route.ts`.

```
GET /api/reports/expense-type-summary?businessUnitId=...&dateFrom=...&dateTo=...
```

Response:
```json
{
  "success": true,
  "data": {
    "byExpenseType": [
      { "expenseTypeId": "...", "name": "...", "count": 12, "totals": [{ "code": "VND", "symbol": "₫", "total": "..." }] },
      { "expenseTypeId": null, "name": "Chưa phân loại", "count": 3, "totals": [...] }
    ]
  }
}
```

- Scope: PURCHASE orders only.
- Groups by `expenseTypeId` AND by `currencyId` (multi-currency). Top-level grouping by expense type with nested per-currency totals.
- Same RBAC as other reports (`GET` on `DASHBOARD`).

## Files

- Modify: `lib/validation-schemas.ts`
- Modify: `app/api/orders/route.ts`, `app/api/orders/[id]/route.ts`
- Create: `app/api/reports/expense-type-summary/route.ts`

## Todo

- [ ] Schema: add `expenseTypeId` (optional, nullable)
- [ ] Schema: refinement — reject expenseTypeId on SALE orders
- [ ] Order POST persists field
- [ ] Order GET list: filter + include expenseType name
- [ ] Order GET detail: include expenseType
- [ ] Order PATCH: allow updating expenseTypeId
- [ ] Create summary route with per-ET + per-currency totals
- [ ] Type-check passes

## Success Criteria

- Create PURCHASE order with `expenseTypeId` → persisted.
- Create SALE order with `expenseTypeId` → 400.
- Filter `GET /api/orders?type=PURCHASE&expenseTypeId=<id>` returns only matching.
- Report endpoint returns correct aggregates including "Chưa phân loại" bucket for NULL.

## Risks

- "Chưa phân loại" grouping key (null) — make sure JSON key is distinct from a real id, use `null` or `"__UNCATEGORIZED__"`.
