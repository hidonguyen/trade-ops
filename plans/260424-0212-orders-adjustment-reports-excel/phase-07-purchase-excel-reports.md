# Phase 07 — Purchase Excel reports (summary + detail)

## Context Links

- Spec: §2.2 (summary 12 cols), §2.3 (detail 14 cols) — same as sales + `LOẠI CHI PHÍ` column
- Service stub: `lib/excel-order-reports-service.ts` (created in phase 06)
- Precedent: phase 06 sales export

## Overview

- Priority: P1
- Status: completed
- Mirror of phase 06 for PURCHASE, adds `LOẠI CHI PHÍ` (expenseType.name) column.

## Key Insights

- Share the same service file — add two functions `exportPurchaseSummary` + `exportPurchaseDetail`.
- Column set is sales + 1 column. DRY by parameterizing column list (pass "extraColumn" config) vs duplicating. **Decision:** parameterize. If service exceeds 200 LOC, split into `excel-purchase-reports-service.ts`.
- Expense type applied at **order** level (purchase orders have `expenseTypeId` from prior plan). Column cell = `order.expenseType?.name ?? ""`.
- Subtotal rows must also show the expense type? Spec examples don't confirm. **Decision:** leave blank on subtotal row (only order-level meaning).

## Requirements

**Functional**

### 7.1 Summary (§2.2) — 12 cols
Same as sales summary + last col `LOẠI CHI PHÍ`.
- Grouping identical (party × currency).
- Subtotal + grand total rules identical.

### 7.2 Detail (§2.3) — 14 cols
Same as sales detail + `LOẠI CHI PHÍ` at col 13 (before `GHI CHÚ`).
- Payment rows + Total row per order; blank row between orders; grand totals by currency.
- `LOẠI CHI PHÍ` shown on Total row; blank on payment rows.

**Non-functional**
- Same filename convention: `bao-cao-mua-hang-tong-hop-…`, `bao-cao-mua-hang-chi-tiet-…`.
- RBAC: PURCHASE module (ADMIN + ACCOUNTANT_PURCHASE + VIEWER).
- Query fetches `order.expenseType` relation.

## Architecture

```
GET /api/reports/purchase-summary/export
GET /api/reports/purchase-detail/export
  → orders where type=PURCHASE AND (orderDate in range OR EXISTS tx.transactionDate in range)
    include party, currency, businessUnit, transactions, expenseType
  → exportPurchaseSummary / exportPurchaseDetail
```

<!-- Updated: Validation Session 1 - union date filter (orderDate OR transactionDate); subtotal label uses party.name -->
**Reminder:** subtotal label format `{partyName}-{currency}` (same rule as phase 06, inherited via parameterized helpers).

## Related Code Files

**Modify**
- `/Users/hido/trade-ops/lib/excel-order-reports-service.ts`
  - Add `exportPurchaseSummary` + `exportPurchaseDetail`
  - Refactor common column logic into helpers (`buildOrderColumns(includeExpenseType)`)
  - If file grows past 200 LOC, split internal helpers to `/Users/hido/trade-ops/lib/excel-order-reports-helpers.ts`

**Create**
- `/Users/hido/trade-ops/app/api/reports/purchase-summary/export/route.ts` (~80 LOC)
- `/Users/hido/trade-ops/app/api/reports/purchase-detail/export/route.ts` (~80 LOC)

**Modify (UI)**
- `/Users/hido/trade-ops/app/(dashboard)/orders/page.tsx` — add export buttons when `urlType === "PURCHASE"` (mirror of phase 06 sales buttons). Reuse same conditional-rendering pattern already used for expense type filter.

## Implementation Steps

1. **Service**
   - Parameterize sales functions: `exportOrderSummary({ orders, dateFrom, dateTo, type })` where `type = "SALE" | "PURCHASE"`.
   - Title and filename differ by type: `BÁO CÁO BÁN HÀNG TỔNG HỢP` vs `BÁO CÁO MUA HÀNG TỔNG HỢP`; filename `bao-cao-ban-hang-…` vs `bao-cao-mua-hang-…`.
   - When type=PURCHASE, append `LOẠI CHI PHÍ` column; include in rows.
   - Keep sales wrapper for backward readability: `exportSalesSummary(...)` calls shared `buildOrderSummaryWorkbook("SALE")`.
2. **Routes**
   - Purchase summary: query PURCHASE orders, call `exportPurchaseSummary`.
   - Purchase detail: query PURCHASE orders, call `exportPurchaseDetail`.
   - Auth: `checkAccess(roles, "GET", "PURCHASE")`.
3. **UI buttons** on orders list for PURCHASE tab — same UX as sales.
4. Verify order query `include` fetches `expenseType: { select: { name } }`.
5. `npx tsc --noEmit`; smoke test.

## Todo List

- [x] Parameterize sales service to accept SALE/PURCHASE type
- [x] Add `exportPurchaseSummary` + `exportPurchaseDetail`
- [x] Create purchase summary route
- [x] Create purchase detail route
- [x] Add export buttons on orders list (PURCHASE)
- [x] Include `expenseType` relation in purchase query
- [x] If service >200 LOC, split to helpers module
- [x] Test with: 3 suppliers × 2 currencies, purchase orders with and without expense type

## Success Criteria

- Purchase summary Excel has 12 cols with `LOẠI CHI PHÍ` last.
- Purchase detail Excel has 14 cols with `LOẠI CHI PHÍ` at position 13, `GHI CHÚ` at 14.
- Orders without expenseType show blank cell (not "null").
- Subtotal/grand rows leave expenseType cell blank.

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| File size >200 LOC on excel-order-reports-service | M | L | Split helpers; keep service as thin orchestration |
| Expense type label missing due to deactivated type | L | L | `expenseType.name` still persisted; show with "(ngừng)" suffix if `!isActive` (follow order list pattern) |

## Security Considerations

- RBAC PURCHASE module gate.
- Same 1-year range cap as sales.

## Open Questions

- Inherited from phase 06: partyName vs partyCode for subtotal label; orderDate vs paymentDate for period filter.

## Next Steps / Dependencies

- Unblocks phase 09 edge-case tests.
