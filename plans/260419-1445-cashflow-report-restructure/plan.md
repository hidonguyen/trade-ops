# Cashflow Report Restructure

**Created:** 2026-04-19
**Status:** completed
**Priority:** high
**Complexity:** low (3-4 files, no schema/API changes)

## Summary

1. Move cashflow page from `/cashflow` to `/reports/cashflow` (sidebar reports section)
2. Restructure table columns: Ngày, Loại, Nguyên tệ, Phí NH, Thực thu/chi, Quy đổi VND, Tham chiếu, Đơn vị
3. Fix "Đơn vị" column (currently empty — needs businessUnit data from API)

## Column Design

| # | Column | Source | Formula |
|---|--------|--------|---------|
| 1 | Ngày | transactionDate | — |
| 2 | Loại | type | Thu/Chi/Thu bán hàng/Chi mua hàng |
| 3 | Nguyên tệ | amountOriginal + currency | — |
| 4 | Phí NH | bankFeeOriginal | — if 0 |
| 5 | Thực thu/chi | computed | Thu: nguyên tệ - phí NH, Chi: nguyên tệ + phí NH |
| 6 | Quy đổi VND | amountVnd | — if currency=VND |
| 7 | Tham chiếu | bankReference | — |
| 8 | Đơn vị | businessUnit.code | — |

## Phases

Single phase — this is pure UI restructuring.

## Implementation Steps

### 1. Move cashflow page to reports section
- Move `app/(dashboard)/cashflow/` → `app/(dashboard)/reports/cashflow/`
- Update sidebar: change `href: "/cashflow"` → `href: "/reports/cashflow"` and move item to reports section

### 2. Restructure table columns
File: `app/(dashboard)/reports/cashflow/page.tsx`
- Replace existing columns with new column set (see Column Design)
- "Thực thu/chi" = computed column:
  - For Thu (RECEIPT/SALE_PAYMENT): amountOriginal - bankFeeOriginal
  - For Chi (PAYMENT/PURCHASE_PAYMENT): amountOriginal + bankFeeOriginal
- "Quy đổi VND": show VND amount only if currency ≠ VND (otherwise show "—")

### 3. Fix "Đơn vị" column
Check if cashflow API includes businessUnit data. If not, add to API includes.

## Dependencies
- None
