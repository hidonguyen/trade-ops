# Phase 04 — Payment method: add CASH (Tiền mặt)

## Context

- `prisma/schema.prisma:177`: `paymentMethod String // BANK, DEPOSIT` — free-form string, not Prisma enum. No migration needed.
- Zod enum `lib/validation-schemas.ts:185`: `z.enum(["BANK", "DEPOSIT"])` — must add `"CASH"`.
- Selects and label maps to update:
  - `components/payment-form.tsx:332-335` (options)
  - `components/transaction-form.tsx:279-281` (options)
  - `components/transaction-edit-dialog.tsx:199` (label)
  - `app/(dashboard)/transactions/page.tsx:49-50, 192` (filter + render)
  - `app/(dashboard)/orders/[id]/order-transactions-table.tsx:56-57` (label map)
  - `app/(dashboard)/reports/summary/page.tsx:171-172` (label fn)
  - `lib/excel-deposit-tracking-service.ts` & any other excel/labels (grep `BANK\|DEPOSIT`)

## Requirements

- `CASH` added as third option, label "Tiền mặt".
- Bank-fee fields stay disabled when method ≠ BANK (CASH should also disable like DEPOSIT).
- Deposit selection stays disabled when method ≠ DEPOSIT.
- Excel exports show "Tiền mặt" for CASH.
- No DB migration (string column).

## Files

- Modify: `lib/validation-schemas.ts` — zod enum BANK|DEPOSIT|CASH (3 places: payment, transaction, refineBankFee guards).
- Modify: `components/payment-form.tsx`, `components/transaction-form.tsx` — add option, ensure bank-fee/deposit branches treat CASH like non-BANK non-DEPOSIT.
- Modify: `components/transaction-edit-dialog.tsx` — extend label switch.
- Modify: `app/(dashboard)/transactions/page.tsx` — filter option + render.
- Modify: `app/(dashboard)/orders/[id]/order-transactions-table.tsx` — label map.
- Modify: `app/(dashboard)/reports/summary/page.tsx` — label fn.
- Modify: any excel service files using paymentMethod label (grep first).

## Implementation steps

1. Grep `"BANK"\|"DEPOSIT"` across repo; list every occurrence.
2. Add `CASH` to zod enum(s) in `lib/validation-schemas.ts`.
3. Update each select options list and label map. Use a shared constant if duplication appears in 3+ places (DRY) — consider `lib/payment-method-labels.ts` map `{ BANK: "Ngân hàng", DEPOSIT: "Cọc", CASH: "Tiền mặt" }`.
4. Verify form logic: setting CASH should clear `depositId` and `bankFee*` (transaction-form already clears bankFee when ≠ BANK; clear depositId when ≠ DEPOSIT).
5. Verify Excel export shows "Tiền mặt" for CASH rows.

## Todo

- [ ] Add CASH to zod schemas
- [ ] Create shared label map (KISS, only if grep shows 3+ sites)
- [ ] Update all selects/filters
- [ ] Update render in lists/details/reports
- [ ] Update Excel label code paths
- [ ] Verify no bank-fee fields when CASH
- [ ] Verify no depositId when CASH
- [ ] Smoke test: create CASH transaction, view in list, edit, export Excel

## Success criteria

- CASH selectable on payment + transaction forms.
- Stored as `paymentMethod = "CASH"` in DB.
- Listed/filtered/exported with label "Tiền mặt".
- No bank-fee or deposit constraints triggered.

## Risks

- **Medium**: missing a label site → "CASH" shown as raw enum. Mitigation: grep both `"BANK"` and `=== "BANK"` patterns; central label map.
- **Low**: existing rows unaffected (no DB constraint change).
