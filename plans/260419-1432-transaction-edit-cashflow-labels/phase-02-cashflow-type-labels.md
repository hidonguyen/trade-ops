# Phase 02 — Cashflow Type Labels

## Overview
- **Priority:** medium
- **Status:** pending
- Show proper labels for all transaction types in cashflow report and transaction list

## Related Code Files
- `app/(dashboard)/cashflow/page.tsx` — update type column labels
- `app/(dashboard)/transactions/page.tsx` — already shows standalone types, may show order-linked in future

## Implementation Steps

### 1. Create shared transaction type label map
Already exists inline in various places. Add comprehensive mapping that covers all 4 types.

### 2. Update cashflow page type labels
File: `app/(dashboard)/cashflow/page.tsx`
Current: `v === "RECEIPT" ? "Thu" : "Chi"` — this doesn't handle SALE_PAYMENT/PURCHASE_PAYMENT
Change to map: 
- RECEIPT → "Thu" (green)
- SALE_PAYMENT → "Thu bán hàng" (green)
- PAYMENT → "Chi" (red)
- PURCHASE_PAYMENT → "Chi mua hàng" (red)

Color logic: `MONEY_IN_TYPES` → green, `MONEY_OUT_TYPES` → red

## Todo List
- [ ] Update cashflow page type labels to handle all 4 types
- [ ] Verify compile

## Success Criteria
- Cashflow report shows "Thu bán hàng" for SALE_PAYMENT
- Cashflow report shows "Chi mua hàng" for PURCHASE_PAYMENT
- Standalone types still show "Thu" and "Chi"
