# Phase 04 — UI: Bank fee input + display

## Overview
- Priority: High
- Status: pending
- Depends on: Phase 02

## Requirements

### Input (transaction creation form)

Component: the order-transaction form (on `/orders/[id]` page) and standalone transaction form (on `/transactions`).

- Show two inputs (`bankFeeOriginal` + auto-computed `bankFeeVnd`) only when `paymentMethod === "BANK"`.
- On paymentMethod switch away from BANK → clear fee values before submit.
- `bankFeeVnd` computed client-side: `bankFeeOriginal × exchangeRate`, rounded per existing amount pattern.
- Validate: fee must be ≥ 0, may be empty (treated as no fee).

### Display (transaction list + detail)

- Transaction list row: show small badge "Phí: 50.000₫" when fee > 0.
- Transaction detail view (if exists): dedicated row "Phí ngân hàng (công ty chịu)".
- On order detail page transaction list, include fee column or badge.

## Files

- Locate transaction form(s) — likely `components/transaction-form.tsx` and/or `app/(dashboard)/transactions/page.tsx`; order-transaction form likely in `app/(dashboard)/orders/[id]/page.tsx` or sub-component.
- Update transaction list rendering in `app/(dashboard)/orders/[id]/page.tsx` and `app/(dashboard)/transactions/page.tsx`.

## Steps

1. Grep for `paymentMethod` + `BANK` to locate form components.
2. Add fee input fields with conditional render.
3. Wire client-side VND computation (reuse existing `amountVnd` helper if any).
4. POST payload includes `bankFeeOriginal` + `bankFeeVnd` when present.
5. Add badge/column to list views; format with existing `CurrencyAmount`.
6. `npm run type-check`.

## Todo

- [ ] Locate order-transaction form component
- [ ] Locate standalone-transaction form component
- [ ] Add conditional fee inputs (both forms)
- [ ] Compute fee VND client-side
- [ ] Submit fee fields in POST
- [ ] Display fee in transaction rows / details
- [ ] Type-check passes
- [ ] Manual test: BANK with fee → stored + debt cleared; DEPOSIT → field hidden
- [ ] Manual test: switching method clears fee

## Success Criteria

- Fee input shown only for BANK.
- Order `paidAmount` after fee-included tx = transaction `amountOriginal` (debt cleared).
- Fee visible in transaction history.

## Risks

- Form state leak when switching methods — must explicitly reset fee.
- Decimal rounding mismatch between client and server — reuse existing rounding path.
