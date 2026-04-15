# Phase 03 — UI: forms "Tạo cọc mới" option

## Overview
- Priority: High
- Status: pending
- Depends on: Phase 01

Relax deposit-selection UX for REFUND so user can pick existing deposit **or** "Tạo cọc mới".

## payment-form.tsx (order-linked)

- Current: when `paymentMethod=DEPOSIT`, Combobox lists existing deposits; required.
- New behavior:
  - Options list = existing deposits **+ one extra entry** `{ value: "__CREATE__", label: "+ Tạo cọc mới từ hoàn tiền" }` — shown only when `paymentType === "REFUND"`.
  - If only "Tạo cọc mới" exists (no existing deposits) and paymentType=REFUND → pre-select it.
  - Validator: PAYMENT + DEPOSIT still requires a real `depositId`. REFUND + DEPOSIT requires a selection (either existing or `__CREATE__`).
- Submit:
  - If `depositId === "__CREATE__"` → send no `depositId` (omit field). Backend auto-creates (it already has order → partyId + BU).
  - Otherwise send `depositId`.

### Edge cases

- When paymentType switches PAYMENT ↔ REFUND, if current `depositId === "__CREATE__"` and switching to PAYMENT → reset to `""`.
- Pre-load deposits regardless of paymentType (already does on `method==="DEPOSIT"`).

## transaction-form.tsx (standalone)

- Current: DEPOSIT method shows Party combobox then Deposit combobox; both required.
- New behavior:
  - When paymentType=REFUND + method=DEPOSIT:
    - Party combobox still required (needed to auto-create).
    - Deposit combobox: add "+ Tạo cọc mới" option.
    - If party has no deposits → only "+ Tạo cọc mới" available.
  - Submit:
    - If `depositId === "__CREATE__"` → omit `depositId`, send `partyId` instead.
    - Otherwise send `depositId` (current behavior).
- Note: standalone form does NOT currently require PAYMENT to have a partyId linked to deposit owner — ensure auto-create path uses form's `partyId` field.

## Files

- Modify: `components/payment-form.tsx`
- Modify: `components/transaction-form.tsx`

## Steps

1. Add `__CREATE__` sentinel constant (e.g., `DEPOSIT_CREATE_NEW = "__CREATE__"`).
2. Inject sentinel option into combobox list conditionally on `paymentType === "REFUND"`.
3. Update validate() logic.
4. Update payload builder to translate sentinel → omit depositId.
5. Visual test via dev server: both forms, both PAYMENT and REFUND flows.

## Todo

- [ ] Add sentinel constant
- [ ] Inject "+ Tạo cọc mới" option for REFUND in payment-form
- [ ] Inject "+ Tạo cọc mới" option for REFUND in transaction-form
- [ ] Validators permit sentinel for REFUND only
- [ ] Payload builder translates sentinel → no depositId
- [ ] Reset sentinel when switching to PAYMENT
- [ ] Manual test matrix:
  - [ ] Order REFUND + DEPOSIT, party has deposits → pick existing → credited
  - [ ] Order REFUND + DEPOSIT, party has deposits → pick "Tạo mới" → new deposit created
  - [ ] Order REFUND + DEPOSIT, party has no deposit → "Tạo mới" auto-preselected → works
  - [ ] Order PAYMENT + DEPOSIT, party has no deposit → user cannot submit (correct)
  - [ ] Standalone mirror of above

## Success Criteria

- All 4+2 test matrix cases pass.
- PAYMENT flow UX unchanged.
- Type-check + manual smoke test green.

## Risks

- Combobox sentinel leaking into PAYMENT form state (must reset).
- Copy: "+ Tạo cọc mới từ hoàn tiền" should be clearly different from real deposits.
