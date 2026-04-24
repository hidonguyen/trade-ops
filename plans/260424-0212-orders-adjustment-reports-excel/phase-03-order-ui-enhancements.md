# Phase 03 — Order UI enhancements (form, detail, list, adjustments)

## Context Links

- Form: `/Users/hido/trade-ops/components/order-form.tsx`
- Summary card: `/Users/hido/trade-ops/app/(dashboard)/orders/[id]/financial-summary-card.tsx`
- Detail page: `/Users/hido/trade-ops/app/(dashboard)/orders/[id]/page.tsx`
- Info card: `/Users/hido/trade-ops/app/(dashboard)/orders/[id]/order-info-card.tsx`
- Tx table: `/Users/hido/trade-ops/app/(dashboard)/orders/[id]/order-transactions-table.tsx`
- List: `/Users/hido/trade-ops/app/(dashboard)/orders/page.tsx`
- Payment form: `/Users/hido/trade-ops/components/payment-form.tsx`

## Overview

- Priority: P1
- Status: completed
- Adds exchangeRate+paymentDueDate to order form, payment due date column on list, adjustment CRUD via existing payment dialog, adjustment total row on summary card, corrected balance formula.

## Key Insights

- Bank fee plan set precedent: derived VND computed client-side. Apply to `orderValueVnd = amount × exchangeRate`.
- Payment form already handles CREATE and EDIT; reuse it for adjustments via a mode flag.
- "Còn phải thanh toán" on list currently computes `orderAmount - paidAmount`. Must become `(orderAmount + adjustmentTotal) - paidAmount`. Since list endpoint doesn't fetch adjustments, **either** (a) include adjustment total in list query, or (b) consume `effectiveValue` from server. **Decision: include `adjustmentTotal` in orders list API** as lightweight aggregate (sum by SQL or Prisma `groupBy` — see impl step 5).

## Requirements

**Functional**
- `OrderForm` adds:
  - `exchangeRate` — NumberInput, 8 decimals, default `1`. Soft warning (amber hint text "Tỷ giá nên nhập cho tiền tệ khác VND") when currency ≠ VND and rate unset — does NOT block save. <!-- Updated: Validation Session 1 - soft warning only -->

  - `paymentDueDate` — DatePicker, optional.
  - Derived VND display (read-only): `amountOriginal × exchangeRate` rendered with thousand separators.
- `OrderInfoCard` shows exchangeRate + paymentDueDate + VND equivalent.
- `FinancialSummaryCard` adds row: "Điều chỉnh giá trị đơn hàng" (signed, red if reducing).
- `FinancialSummaryCard` balance = effective − paid (uses `effectiveValueOriginal` from report).
- Orders list: new column `HẠN THANH TOÁN`; balance column uses effective value; expenseType column remains PURCHASE-only.
- Adjustment creation: button on detail page "Thêm điều chỉnh" opens payment dialog in `mode=adjustment` — hides bank fee + deposit + paymentMethod, allows signed amount.
- Adjustment listed in `OrderTransactionsTable` with dedicated label "Điều chỉnh giá trị đơn hàng" + signed display (- or +).
- Edit/delete of adjustment reuses existing PATCH/DELETE flow.

**Non-functional**
- No breaking change to existing payment CRUD
- Keep each modified file under 200 LOC — split adjustment-specific logic if payment-form balloons (see step 3)

## Architecture

```
User → OrderForm (create/edit)
  └─ submits {..., exchangeRate, paymentDueDate}
  └─ VND display computed client-side

User → Order detail → "Thêm điều chỉnh" button
  └─ PaymentForm(mode="adjustment")
      └─ POST /api/orders/[id]/transactions
         { type: "ORDER_ADJUSTMENT", paymentType: "ADJUSTMENT",
           paymentMethod: "BANK", amountOriginal: signed, ... }
  └─ Order detail refetches → FinancialSummaryCard shows adjustment row
```

## Related Code Files

**Modify**
- `/Users/hido/trade-ops/components/order-form.tsx` (add two fields + client-side VND)
- `/Users/hido/trade-ops/components/payment-form.tsx` (add adjustment mode)
- `/Users/hido/trade-ops/app/(dashboard)/orders/new/page.tsx` (payload includes new fields)
- `/Users/hido/trade-ops/app/(dashboard)/orders/[id]/edit/page.tsx` (payload + initialData)
- `/Users/hido/trade-ops/app/(dashboard)/orders/[id]/page.tsx` (adjustment button + dialog state)
- `/Users/hido/trade-ops/app/(dashboard)/orders/[id]/order-info-card.tsx` (show exchangeRate + dueDate)
- `/Users/hido/trade-ops/app/(dashboard)/orders/[id]/financial-summary-card.tsx` (adjustment row + corrected balance)
- `/Users/hido/trade-ops/app/(dashboard)/orders/[id]/order-transactions-table.tsx` (label + signed render for ADJUSTMENT)
- `/Users/hido/trade-ops/app/(dashboard)/orders/page.tsx` (paymentDueDate column + balance uses effective)
- `/Users/hido/trade-ops/app/api/orders/route.ts` (createOrderSchema fields + list response include adjustment aggregate)
- `/Users/hido/trade-ops/app/api/orders/[id]/route.ts` (PATCH accepts new fields)
- `/Users/hido/trade-ops/lib/validation-schemas.ts` (extend createOrderSchema)

**Create (only if payment-form grows >200 LOC after changes)**
- `/Users/hido/trade-ops/components/order-adjustment-form.tsx` — split out adjustment-specific form (keep `payment-form.tsx` focused on PAYMENT/REFUND)

## Implementation Steps

1. **`validation-schemas.ts` — `createOrderSchema`**
   - Add `exchangeRate: decimalString.default("1")`.
   - Add `paymentDueDate: dateField.optional().nullable()`.
   - Update `updateOrderSchema` similarly (same file).
2. **`OrderForm`**
   - Add `exchangeRate` (NumberInput, 8 decimals) + `paymentDueDate` (DatePicker) to `OrderFormData`.
   - Auto-default `exchangeRate = "1"` when currency switches to VND.
   - Display derived VND: `<span>≈ {formatVnd(amount × rate)} VND</span>` under amount input.
   - Validate: non-VND currency + rate missing/1 → soft warning (not blocker) "Vui lòng nhập tỷ giá".
3. **Adjustment dialog strategy**
   - Extend `PaymentForm` with prop `mode?: "payment" | "adjustment"`.
   - In adjustment mode: hide paymentMethod/deposit/bankFee inputs; show signed amount hint "Nhập số âm để giảm giá trị đơn hàng"; validate amount ≠ 0.
   - On submit, inject `type: "ORDER_ADJUSTMENT", paymentType: "ADJUSTMENT", paymentMethod: "BANK"`.
   - If payment-form.tsx exceeds 200 LOC after changes → extract adjustment mode into `order-adjustment-form.tsx`; detail page chooses which dialog to render.
4. **Order detail page (`[id]/page.tsx`)**
   - Add state + button "Thêm điều chỉnh" next to "Thêm thanh toán".
   - Pass new report field `summary.adjustmentTotalOriginal` to `FinancialSummaryCard`.
5. **`FinancialSummaryCard`**
   - Add SummaryRow for adjustment — highlight `negative` if < 0, `positive` if > 0, `neutral` if 0.
   - Read `effectiveValueOriginal` from summary prop; use it for the "Còn phải thanh toán" row.
6. **`OrderInfoCard`**
   - Render `exchangeRate` + `paymentDueDate` (format dd/MM/yyyy) + derived VND equivalent (`amountOriginal × exchangeRate`).
7. **Orders list**
   - Add column `paymentDueDate` ("Hạn TT") — render dd/MM/yyyy or "—" when null.
   - Update "Còn phải TT" to use effective: API returns new aggregate `adjustmentTotal` per order (see step 9); compute `effective - paid`.
8. **`OrderTransactionsTable`**
   - Extend `PAYMENT_TYPE_LABEL` with `ADJUSTMENT: "Điều chỉnh"`.
   - For ADJUSTMENT rows: prefix amount with `+` or `-`; skip bank-fee/deposit columns (null).
9. **List API (`/api/orders/route.ts`)**
   - GET query: include `adjustmentTotal` per order using Prisma `select` on transactions filtered by `paymentType=ADJUSTMENT`, aggregated server-side via `_sum` or post-map. Keep payload shape backward-compat (add field, don't remove).
   - Return field: `adjustmentTotal: string` (signed Decimal toFixed(4)).
10. **Order create/update routes**
   - Pass `exchangeRate`, `paymentDueDate` from schema-validated body through to `prisma.order.create/update`.
11. Manual test: create SALE order in USD with rate 25000, amount 100; detail shows 2,500,000 VND.
12. Compile-check: `npx tsc --noEmit`.

## Todo List

- [x] Extend zod create/update order schemas
- [x] Add `exchangeRate` + `paymentDueDate` fields in OrderForm
- [x] Add client-side VND display
- [x] Add adjustment mode to PaymentForm (or split to order-adjustment-form.tsx)
- [x] Detail page: "Thêm điều chỉnh" button wired
- [x] OrderInfoCard shows rate + due date + VND
- [x] FinancialSummaryCard shows adjustment row + uses effective for balance
- [x] OrderTransactionsTable renders ADJUSTMENT with label + sign
- [x] Orders list: new "Hạn TT" column + effective-balance
- [x] Orders list API returns adjustmentTotal per row
- [x] Create/update order API accepts new fields
- [ ] tsc clean

## Success Criteria

- Creating an order with exchangeRate persists round-trip.
- VND derived display updates live as amount or rate changes.
- Adjustment of −1,000,000 appears in tx table with signed amount and correct label.
- Summary card row "Điều chỉnh giá trị đơn hàng" shows signed total.
- "Còn phải thanh toán" matches spec formula.
- Orders list shows Hạn TT column; balance correctly reflects adjustments.

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| PaymentForm becomes a god-component | H | M | Split into order-adjustment-form.tsx if >200 LOC |
| List API payload growth hurts perf | L | L | `adjustmentTotal` is a single aggregate per row; cheap |
| User forgets exchangeRate on non-VND edit | M | M | Soft warning on form; Excel reports show rate = 1 clearly (so error is visible) |
| DatePicker nullability mishandled | L | L | Explicit `onChange("" | dateStr)` + schema `.nullable()` |

## Security Considerations

- Standard RBAC on order write endpoints — no change.
- paymentDueDate not PII; no extra protection.

## Open Questions

- Should exchangeRate be required (hard validation) when currency ≠ VND, or remain soft-warning? Current plan: soft-warning to avoid blocking legacy edits.

## Next Steps / Dependencies

- Unblocks phase 09 edge-case testing.
