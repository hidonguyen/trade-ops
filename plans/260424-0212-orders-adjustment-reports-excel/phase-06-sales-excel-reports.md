# Phase 06 — Sales Excel reports (summary + detail)

## Context Links

- Spec: §1.2 (summary 11 cols), §1.3 (detail 13 cols) in prompt
- Utils: `lib/excel-report-utils.ts` (phase 05)
- Precedent: `app/api/reports/summary/export/route.ts` (current DOCX, template for query shape)

## Overview

- Priority: P1
- Status: completed
- Adds two Excel export endpoints for SALE orders, grouped by customer×currency, with subtotal + grand-total rows.

## Key Insights

- Spec says "ĐƠN VỊ = TK" — that's `BusinessUnit.code` (not a constant). Group filter uses selected BU from UI.
- Summary subtotal row label in col 2 = `"{partyName}-{currency}"`. <!-- Updated: Validation Session 1 - party.name confirmed, no Party.code field -->
- Detail sheet: each payment tx is 1 row, then 1 Total row per order with suffix `-Total` in col 3.
- Both sheets filter by `dateFrom/dateTo` applied to **either orderDate OR transactionDate** (union). SQL: `WHERE orderDate BETWEEN :from AND :to OR EXISTS (SELECT 1 FROM Transaction WHERE orderId = Order.id AND transactionDate BETWEEN :from AND :to)`. Captures old orders with period activity AND new orders with no activity yet. <!-- Updated: Validation Session 1 - union date filter -->
- Adjustments shown as "GIẢM GIÁ TRỊ ĐƠN HÀNG" — display absolute value of negative sum (spec says "hiển thị dương"); positive adjustments (rare) shown as negative in that column per convention, or in a separate row. **Decision:** column value = `-adjustmentTotal` (flip sign so reductions show positive). Positive adjustments appear negative in this column — document in cell header.

## Requirements

**Functional**

### 6.1 Summary (§1.2)
- 11 columns: ĐƠN VỊ, ĐỐI TÁC, SỐ ĐƠN, NGÀY ĐƠN HÀNG, HẠN THANH TOÁN, TIỀN TỆ, GIÁ TRỊ ĐH, GIẢM GIÁ TRỊ ĐH, ĐÃ THANH TOÁN, CÒN PHẢI TT, TRẠNG THÁI.
- Group by (partyId, currencyId). For each group:
  - Order rows
  - Subtotal row (col 2 = `{partyName}-{currencyCode}`, cols 7/8/9/10 summed)
  - Blank row
- Grand total rows at end, one per currency: col 6 = `Grand-{currency}`, sum cols 7/8/9/10 across all groups.

### 6.2 Detail (§1.3)
- 13 columns: ĐƠN VỊ, ĐỐI TÁC, SỐ ĐƠN, NGÀY ĐƠN HÀNG, TIỀN TỆ, GIÁ TRỊ ĐH, GIẢM GIÁ TRỊ ĐH, HẠN TT, NGÀY TT, THANH TOÁN LẦN NÀY, CÒN PHẢI TT, TRẠNG THÁI, GHI CHÚ.
- Per order: N payment rows + 1 Total row (col 3 = `{orderNumber}-Total`). Payment rows leave cols 6/7/11/12/13 blank; Total row leaves col 9 blank.
- Blank row between orders.
- Grand total per currency (col 5 = `Grand-{currency}`, sum cols 6/7/10/11).

**Non-functional**
- Performance: single Prisma query with nested includes; no N+1.
- Both endpoints support query params `dateFrom`, `dateTo`, optional `businessUnitId`.
- Filename: `bao-cao-ban-hang-tong-hop-{YYYYMMDD}-{YYYYMMDD}.xlsx` / `bao-cao-ban-hang-chi-tiet-{YYYYMMDD}-{YYYYMMDD}.xlsx`.

## Architecture

```
GET /api/reports/sales-summary/export?dateFrom&dateTo&businessUnitId
  → query orders where type=SALE AND (orderDate in range OR EXISTS tx.transactionDate in range), buId optional
    include: party, currency, businessUnit, transactions (filter ADJUSTMENT + PAYMENT)
  → group by party×currency
  → buildSalesSummaryWorkbook(groups, range) via excel-order-reports-service
  → stream .xlsx

GET /api/reports/sales-detail/export?...
  → same query
  → buildSalesDetailWorkbook(orders, range)
```

## Related Code Files

**Create**
- `/Users/hido/trade-ops/lib/excel-order-reports-service.ts` (~180 LOC)
  - `exportSalesSummary(data, dateFrom, dateTo): Promise<Buffer>`
  - `exportSalesDetail(data, dateFrom, dateTo): Promise<Buffer>`
  - Internal helpers for grouping + building group/subtotal/grand rows
- `/Users/hido/trade-ops/app/api/reports/sales-summary/export/route.ts` (~80 LOC)
- `/Users/hido/trade-ops/app/api/reports/sales-detail/export/route.ts` (~80 LOC)

**Modify**
- Add two "Xuất báo cáo" buttons somewhere on `/orders?type=SALE` page (existing orders list) OR a new `/reports/sales` page. **Decision:** add buttons directly on orders list header (above FilterBar) to avoid new navigation. File: `app/(dashboard)/orders/page.tsx`.

## Implementation Steps

1. **Service** `lib/excel-order-reports-service.ts`:
   - Define `SaleOrderForExport` shape: `{ businessUnitCode, partyName, orderNumber, orderDate, paymentDueDate, currencyCode, amountOriginal, adjustmentTotal, paidAmount, balanceOriginal, effectiveValue, status, notes, payments: [{ transactionDate, amountOriginal }] }`.
   - Summary function:
     - Sort input by (partyName, currencyCode, orderDate).
     - Iterate; on (party, currency) break → emit subtotal then blank.
     - Track grand totals dict keyed by currency.
     - At end, emit one grand row per currency.
   - Detail function:
     - Iterate orders; for each, emit payment rows + one Total row; blank between orders.
     - Track grand totals per currency across payments (col 10) and order totals (cols 6/7/11).
   - Use `applyHeaderStyle`, `applySubtotalStyle`, `applyGrandTotalStyle`, `addTitleRow`, `addDateRangeRow`, `applyNumberFormat` from `excel-report-utils`.
   - Number cells: write as actual number (from `parseFloat`) so format applies; not strings. Use `Decimal(…).toNumber()` (safe since display only).
   - Status rendered as VN label via existing `STATUS_LABEL` helper (move to shared util if not already).
2. **Routes**:
   - Auth: `withAuth` + `checkAccess(roles, "GET", "SALE")`.
   - Query zod: `dateFrom`, `dateTo`, optional `businessUnitId`.
   - Prisma query: `orders` where type=SALE + date range + BU; include party, currency, businessUnit, transactions (ADJUSTMENT + PAYMENT).
   - Map orders → `SaleOrderForExport` shape (compute adjustmentTotal + effective + balance here, reusing logic from phase 02 — extract to `lib/order-aggregates.ts` if duplicated).
   - Call service, return blob with `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` + `Content-Disposition: attachment; filename=...`.
3. **UI buttons** on `/orders?type=SALE`:
   - Two buttons "Xuất tổng hợp Excel", "Xuất chi tiết Excel" calling `window.open(...)` with current filters.
   - Disable when no dateFrom/dateTo selected.
4. **Shared aggregate util** (if duplicate logic arises):
   - `lib/order-aggregates.ts`: `computeOrderAggregates(orderWithTxs) → { adjustmentTotal, effectiveValue, balance, paidAmount, refundedAmount }`. Used by list API + report API + (later) cashflow. Keep under 100 LOC.
5. `npx tsc --noEmit`; manual smoke test with seed data.

## Todo List

- [x] Create `excel-order-reports-service.ts` with sales summary + detail
- [x] Create sales summary export route
- [x] Create sales detail export route
- [x] Add export buttons on orders list (SALE)
- [x] Extract shared aggregate util (if needed) to `order-aggregates.ts`
- [x] Verify filename format matches spec
- [x] Test with: 2 customers × 3 currencies = 6 groups, 20 orders, adjustments mixed
- [x] Test empty period → empty sheet with title + no crash

## Success Criteria

- Summary Excel opens in Excel/LibreOffice with 11 cols + subtotals + grand totals per currency.
- Detail Excel opens with 13 cols + payment rows + Total rows + grand totals.
- Status column displays Vietnamese label ("Chưa TT", "TT 1 phần", "Đã TT", "Hoàn 1 phần", "Đã hoàn").
- Negative adjustments appear as positive numbers in "GIẢM GIÁ TRỊ ĐH" column.
- Orders with `paymentDueDate = null` → cell blank (not "null" text).

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Large dataset (>5k orders) slow | M | M | Paginate fetch; stream workbook (exceljs supports write stream) — defer until observed |
| Subtotal sum drift vs display due to Decimal→Number conversion | L | M | Use Decimal for all math; convert to Number only at cell write; spec format `#,##0` rounds cents which is acceptable |
| Grand total currency ordering unstable | L | L | Sort currencies alphabetically by code |
| User exports with 1-year range, server OOM | L | H | Cap server-side to 366 days; reject with 400 if exceeded |

## Security Considerations

- RBAC: SALE module gate (ADMIN + ACCOUNTANT_SALE + VIEWER).
- Date range cap (1 year) to prevent resource abuse.

## Open Questions

- Does "ĐƠN VỊ = TK" (business unit code) imply the report is single-BU, or lists all BUs with code column varying? Current plan: filter by selected BU; column shows that BU's code on every row. Confirm.
- Is filter "period" applied to orderDate or transactionDate? Current plan: orderDate. Confirm with stakeholder before shipping.
- Should Party get a `code` field for the `{customerCode}-{currency}` subtotal label? Current plan: use `party.name`. Schema addition would be a separate phase.

## Next Steps / Dependencies

- Unblocks phase 09 edge-case validation.
