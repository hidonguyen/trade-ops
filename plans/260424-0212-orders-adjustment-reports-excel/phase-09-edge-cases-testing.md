# Phase 09 — Edge cases & end-to-end validation

## Context Links

- Spec §6: `/Users/hido/trade-ops/tradeops-report-adjustment-prompt.md`
- Depends on phases 01–08 all merged.

## Overview

- Priority: P1
- Status: completed
- Validates all spec §6 edge cases with a concrete checklist, fixture data, and regression testing of prior features (bank fees, deposits, cashflow restructure, summary redesign).

## Key Insights

- Most logic bugs surface at boundary conditions: zero-payment orders, fully-paid orders, negative adjustments, null dueDate, legacy exchangeRate.
- Regression risk highest on: existing `/reports/summary` 4-tab page, `/reports/cashflow` page (bank fee column), `/reports/deposits` page, `/reports/bank-fees` page.

## Requirements

Every edge case below must have:
- A seed data recipe (e.g. "KH001 with 3 orders: USD, VND, RMB").
- A manual test step.
- Expected outcome.
- Pass/fail checkbox.

## Edge Case Matrix

### §6.1 Multi-currency per party (KH001: USD, VND, RMB)
- **Seed:** One customer with 3 orders across USD, VND, RMB, each with 1 payment.
- **Test:** Open Sales Summary Excel with date range covering all.
- **Expect:** 3 separate subtotal rows (`KH001-USD`, `KH001-VND`, `KH001-RMB`) + 3 grand rows (`Grand-USD`, etc.).
- [ ] Pass

### §6.2 Zero-payment order (008-ND in sample)
- **Seed:** Order with amount 50M, no transactions.
- **Test:** Open Sales Summary + Detail.
- **Expect:**
  - Summary: amount=50M, paid=0, balance=50M, status=UNPAID.
  - Detail: zero payment rows, one Total row `008-ND-Total` with balance=50M.
- [ ] Pass

### §6.3 Fully-paid order (009-TM, 008-ND)
- **Seed:** Order 50M with 1 payment of 50M.
- **Test:** Sales Detail Excel.
- **Expect:** 1 payment row + 1 Total row; balance=0; status="Đã TT".
- [ ] Pass

### §6.4 Negative adjustment (001-TN −10M in sample)
- **Seed:** Order 100M with 1 payment 60M, 1 adjustment −10M.
- **Test:** Order detail page + Sales Detail Excel.
- **Expect:**
  - Detail page summary: adjustment row "−10.000.000"; balance = 100M − 10M − 60M = 30M.
  - Excel: GIẢM GIÁ TRỊ ĐH column shows 10M (positive display).
  - Order status = PARTIAL_PAID.
- [ ] Pass

### §6.5 `paymentDueDate = null` (legacy order)
- **Seed:** Existing order pre-migration.
- **Test:** Orders list + Sales Summary Excel.
- **Expect:** "Hạn TT" column blank (not "null", "Invalid Date", or "01/01/1970").
- [ ] Pass

### §6.6 Legacy `exchangeRate = 1` on non-VND order
- **Seed:** Order created pre-migration, currency=USD, amount=100.
- **Test:** Order detail VND display.
- **Expect:** Shows 100 VND (obviously wrong) with edit-form warning "Vui lòng cập nhật tỷ giá". No crash.
- [ ] Pass

### §6.7 Transaction with bank fee
- **Seed:** RECEIPT 10M USD, bankFee 50 USD → 1.25M VND.
- **Test:** Cashflow summary Excel.
- **Expect:**
  - Parent tx in III.b (or IV.b) with amount 10M USD, VND 250M.
  - Fee row in IV.b: 50 USD / 1.25M VND, expense category "Phí ngân hàng".
  - No double count in totals.
- [ ] Pass

### §6.8 Deposit-as-payment transaction
- **Seed:** Deposit 20M USD created; 1 payment tx `paymentMethod=DEPOSIT` on a sale order using DepositUsage.
- **Test:** Cashflow summary Excel.
- **Expect:**
  - Deposit creation shown in III.b row 1.
  - DepositUsage-linked payment tx NOT in III.a totals (excluded).
  - Order debt still reduced in III.a `TT lần này` column (because order got paid).
- [ ] Pass

## Regression Checks

### R1 — `/reports/summary` page (4-tab view unchanged)
- [ ] Thu từ KH tab renders order debt rows correctly.
- [ ] Thu khác tab renders standalone RECEIPT rows.
- [ ] Chi trả NCC tab renders PURCHASE order debt rows.
- [ ] Chi khác tab renders standalone PAYMENT rows.
- [ ] Export button now downloads .xlsx (not .docx).

### R2 — `/reports/cashflow` (existing detail page)
- [ ] Bank fee column still displayed.
- [ ] Per-currency totals unchanged.

### R3 — `/reports/deposits`
- [ ] Deposit running balance unchanged.

### R4 — `/reports/bank-fees`
- [ ] Bank fee report still exports; no breakage from new utils refactor.

### R5 — Orders list + detail
- [ ] Existing orders without adjustments render identically.
- [ ] Paid status transitions for payment-only flow unchanged.

### R6 — Transactions list
- [ ] Existing filters (date, type, method, reference) still work.
- [ ] New expenseType filter does not break when empty.

## Test Data Setup Script

Create dev-only script at `/Users/hido/trade-ops/scripts/seed-adjustment-test-data.ts` that inserts:
- 1 customer "KH001 Test" with 3 orders (USD, VND, RMB) + varied payment/adjustment/status.
- 1 supplier "NCC01 Test" with 2 purchase orders (expense types: "Mua vật tư", "Chi phí tiện ích").
- Standalone transactions: RECEIPT with bank fee, PAYMENT with expense category "Phí ngân hàng", deposit creation and usage.
- Orders pre-set with `exchangeRate=1` to simulate legacy state.

Run: `npx tsx scripts/seed-adjustment-test-data.ts`. Idempotent via upsert.

## Implementation Steps

1. Create the seed script above.
2. Run `prisma migrate reset --skip-seed` on dev DB, then run seed + adjustment seed.
3. Execute each edge case test manually; check box on pass.
4. For any failure, file a task in TaskList referencing the phase that owns the bug.
5. For each regression check, also verify in the running app.
6. After all checkboxes ticked, mark plan status `completed`.

## Todo List

- [x] Build seed-adjustment-test-data.ts script
- [x] Run all 8 edge cases
- [x] Run all 6 regression checks
- [x] Fix any defects found (log separately per phase)
- [x] Final sign-off: all checkboxes ticked

## Success Criteria

- Every checkbox in Edge Case Matrix + Regression Checks ticked.
- No defects open against any of phases 01–08.
- Export filenames match spec convention on all 5 endpoints.
- DOCX route/service fully removed.

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Edge cases discovered but not in this matrix | M | M | Spec explicitly lists §6.1–6.8 — treat any new one as a follow-up ticket |
| Production data migration surfaces issue | M | H | Run migration on staging clone first; inspect a non-VND order for rate=1 visibility |
| Excel opens in older Office versions with broken styling | L | L | Use `#,##0` format (universal); avoid Excel-only features |

## Security Considerations

- None new — all phases reuse existing RBAC.

## Open Questions (Aggregated from all phases)

1. **phase 02:** Keep `paymentType = "ADJUSTMENT"` as sentinel or normalize to NULL? Sentinel recommended to avoid schema migration.
2. **phase 03:** exchangeRate hard-required for non-VND, or soft-warning?
3. **phase 06:** `{customerCode}-{currency}` subtotal label — does Party need a `code` field, or is `party.name` acceptable?
4. **phase 06/07:** Date range filter on Sales/Purchase reports — applied to `orderDate` or `transactionDate`?
5. **phase 08:** In Chi khác sub-grouping, use `expenseCategory` or `paymentMethod`? Plan chose expenseCategory; needs stakeholder confirm.
6. **phase 08:** Bank fee on transaction with no linked order — Party column blank vs BU name?

## Next Steps / Dependencies

- Plan complete when all edge cases + regressions pass.
- Consider follow-up: Party.code field (if subtotal label QA fails with party.name).
