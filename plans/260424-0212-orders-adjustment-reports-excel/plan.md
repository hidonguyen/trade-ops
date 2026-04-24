---
title: "Orders adjustment + payment due date + Excel reports suite"
description: "Add order adjustments, exchange rates, payment due dates, transaction expense categories, and 4 new Excel reports (sales/purchase summary + detail, cashflow)"
status: completed
priority: P1
effort: ~18h
branch: main
tags: [orders, transactions, reports, excel, schema-migration, i18n-vn]
created: 2026-04-24
---

# Plan: Orders adjustment & Excel reports suite

## Context

Spec: `/Users/hido/trade-ops/tradeops-report-adjustment-prompt.md`
User-approved decisions locked in §Decisions below.

## Scope

- Add `Order.exchangeRate` + `Order.paymentDueDate`
- Add `Transaction.expenseTypeId` (reuse existing `ExpenseType`)
- New transaction type `ORDER_ADJUSTMENT` (negative amounts allowed)
- Order detail page: "Điều chỉnh giá trị đơn hàng" row + corrected "Còn phải thanh toán" formula
- 4 Excel reports: sales summary, sales detail, purchase summary, purchase detail
- Replace cashflow summary DOCX export with hierarchical III/IV Excel
- Transaction list: expenseCategory column + filter

## Key Decisions

1. **Reuse `ExpenseType` FK** for Transaction (no new table). Seed additional: "Phí ngân hàng", "Cọc".
2. **Adjustment impact on status:** `effectiveValue = amountOriginal + sum(adjustments)`. Status + balance use `effectiveValue`.
3. **Summary Excel replaces DOCX** on `/reports/summary`. DOCX route + service removed after Excel live.
4. **Migration backfill:** `Order.exchangeRate = 1` for ALL existing orders. `Order.paymentDueDate = NULL`.
5. **VND conversion:** computed client-side using `orderValue × exchangeRate` (same pattern as bank fee plan).

## Phases

| # | File | Priority | Blockers | Status |
|---|------|----------|----------|--------|
| 01 | phase-01-schema-migration.md | P1 | — | completed |
| 02 | phase-02-adjustment-transaction-logic.md | P1 | 01 | completed |
| 03 | phase-03-order-ui-enhancements.md | P1 | 01, 02 | completed |
| 04 | phase-04-transaction-expense-category.md | P2 | 01 | completed |
| 05 | phase-05-excel-common-utilities.md | P1 | 01 | completed |
| 06 | phase-06-sales-excel-reports.md | P1 | 01, 05 | completed |
| 07 | phase-07-purchase-excel-reports.md | P1 | 01, 05 | completed |
| 08 | phase-08-cashflow-summary-excel.md | P1 | 01, 05 | completed |
| 09 | phase-09-edge-cases-testing.md | P1 | 02, 03, 04, 06, 07, 08 | completed |

## Dependencies

```
01 ──┬──> 02 ──> 03
     ├──> 04
     └──> 05 ──┬──> 06 ──┐
              ├──> 07 ──┤
              └──> 08 ──┴──> 09
                           ▲
                    02, 03, 04 ─┘
```

## Data Flow (high level)

```
User edits order ──> Order.exchangeRate, paymentDueDate persisted
User adds adjustment ──> Transaction(type=ORDER_ADJUSTMENT, amount signed)
                         └──> recalcOrderStatus uses effectiveValue = amount + Σadj
Report export:
  Sales/Purchase ──> Query orders + transactions ──> Group by party×currency
                     ──> exceljs workbook ──> stream .xlsx
  Cashflow ──> Query standalone + order payments + bank fees + deposits
               ──> III.a/III.b/IV.a/IV.b sections ──> exceljs
```

## File Ownership (no overlap)

- **Schema + seed:** `prisma/schema.prisma`, `prisma/seed.ts`, new migration dir (phase 01)
- **Order transaction logic:** `lib/validation-schemas.ts`, `lib/order-status-calculator.ts`, `app/api/orders/[id]/transactions/*`, `app/api/orders/[id]/report/route.ts` (phase 02)
- **Order UI:** `components/order-form.tsx`, `components/payment-form.tsx`, `app/(dashboard)/orders/page.tsx`, `app/(dashboard)/orders/[id]/*` (phase 03)
- **Transaction UI + API:** `components/transaction-form.tsx`, `components/transaction-edit-dialog.tsx`, `app/(dashboard)/transactions/page.tsx`, `app/api/transactions/route.ts` (phase 04)
- **Excel utils (new):** `lib/excel-report-utils.ts`, `lib/excel-order-reports-service.ts`, `lib/excel-cashflow-summary-service.ts` (phases 05–08)
- **Export routes (new):** `app/api/reports/sales-summary/export`, `sales-detail/export`, `purchase-summary/export`, `purchase-detail/export`; repurpose `app/api/reports/summary/export/route.ts` (phase 05–08)
- **Delete:** `lib/docx-summary-export-service.ts` (phase 08 final step)

## Success Criteria (plan-level)

- All 4 Excel exports produce files matching column spec in §1.2, §1.3, §2.2, §2.3
- Cashflow summary Excel matches §4.1 structure with hierarchical III/IV sections
- Order detail shows "Điều chỉnh giá trị đơn hàng" row with signed sum
- "Còn phải thanh toán" on detail + list + reports = `effectiveValue − paidAmount`
- All §6 edge cases pass checklist in phase 09
- No regression on existing summary tabs, bank fee report, deposit report
- DOCX export route/service removed; no dead imports

## Open Questions (resolved — see Validation Log)

All 6 open questions resolved in Validation Session 1 (2026-04-24).

## Validation Log

### Session 1 — 2026-04-24
**Trigger:** `/ck-plan validate` after initial plan draft
**Questions asked:** 6

#### Questions & Answers

1. **[Architecture]** ORDER_ADJUSTMENT transaction `paymentType` column value (currently NOT NULL, PAYMENT/REFUND).
   - Options: Add sentinel `'ADJUSTMENT'` | Make paymentType nullable | Reuse PAYMENT with type discriminator
   - **Answer:** Add sentinel `'ADJUSTMENT'` value (Recommended)
   - **Rationale:** Avoids schema migration. Enum extends naturally. Keeps NOT NULL constraint.

2. **[Assumptions]** Order.exchangeRate enforcement for non-VND currency.
   - Options: Hard-required, block save | Soft warning, allow save | No enforcement
   - **Answer:** Soft warning, allow save
   - **Rationale:** Prefers UX flexibility over data quality. User may have legitimate reasons to save without rate (TBD later). Reports must handle missing rate gracefully (show blank VND column).

3. **[Architecture]** Sales summary subtotal label — source for `{X}` in `{X}-{currency}` format.
   - Options: party.name | Add Party.code field | party.id prefix
   - **Answer:** Use party.name (Recommended)
   - **Rationale:** Zero schema change. Self-explanatory label. No backfill needed. Label format: `"Công ty ABC-USD"`.

4. **[Scope]** Sales/Purchase report date filter — applied to which date?
   - Options: orderDate | transactionDate | Union (either)
   - **Answer:** Either order OR transaction date in period (union)
   - **Rationale:** Most inclusive. Captures old orders with activity in period AND new orders with no activity yet. Requires `WHERE orderDate BETWEEN ... OR EXISTS (tx with transactionDate BETWEEN ...)`.

5. **[Architecture]** Cashflow summary IV.1.b "Chi khác" sub-grouping.
   - Options: By paymentMethod | By expenseCategory | No sub-grouping (flat)
   - **Answer:** No sub-grouping — flat list with TOTAL row
   - **Rationale:** Simplest. Single section of transactions, one total at bottom. Drops "Ngân hàng vs Cọc" verbal split from spec in favor of clarity.

6. **[Architecture]** Bank-fee row Party/NCC column when no linked order.
   - Options: Blank | BusinessUnit name | Fixed label "(Phí ngân hàng)"
   - **Answer:** Blank (Recommended)
   - **Rationale:** Standalone bank fee has no party semantically. Description field identifies source.

#### Confirmed Decisions

- `paymentType = 'ADJUSTMENT'` sentinel; no schema migration of paymentType column
- `exchangeRate` for non-VND: soft warning only, save allowed; reports tolerate missing rate
- Report subtotal label: `party.name` (no new Party.code field)
- Sales/Purchase report date filter: union of orderDate and transactionDate in range
- Chi khác: flat list, no sub-grouping
- Bank-fee unattached to order: Party column blank

#### Action Items

- [x] Update phase-02: confirm paymentType sentinel
- [x] Update phase-03: exchangeRate soft warning (remove "hard required")
- [x] Update phase-06, phase-07: use party.name for subtotal label; query uses orderDate OR transactionDate union
- [x] Update phase-08: Chi khác flat (remove sub-grouping logic); bank-fee Party blank

#### Impact on Phases

- **Phase 02:** No change (already planned sentinel). Remove open question.
- **Phase 03:** Update exchangeRate validation — soft warning via form hint, no form-level rejection.
- **Phase 06 & 07:** Update subtotal label spec to `party.name`; update order query to use `OR` between orderDate and transaction dates in range.
- **Phase 08:** Drop "Phân nhóm theo PTTT" sub-grouping from spec; IV.1.b renders as single flat table + TOTAL row. Clarify Party column blank when no linked order.
