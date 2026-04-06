---
title: "Phase 2: Apply Components to All Forms"
status: completed
priority: P2
effort: 2.5h
blockedBy: [phase-01]
completed_date: 2026-04-04
---

# Phase 2: Apply New Components to All Forms

## Overview

Replace existing Select/Input controls with Combobox, DatePicker, and NumberInput across all form components.

## Files to Modify

| File | Combobox | DatePicker | NumberInput |
|------|----------|------------|-------------|
| `components/order-form.tsx` | party, BU, currency | orderDate | amountOriginal |
| `components/transaction-form.tsx` | BU, currency, party (deposit) | transactionDate | amountOriginal, exchangeRate, amountVnd (read-only) |
| `components/payment-form.tsx` | deposit selection | transactionDate | amountOriginal, exchangeRate, amountVnd (read-only) |
| `components/deposit-form.tsx` | currency, BU | — | amountOriginal |
| `components/party-form.tsx` | BU | — | — |

## Implementation Steps

### order-form.tsx
1. Import Combobox, DatePicker, NumberInput
2. Replace party Select → `<Combobox options={parties.map(p => ({value: p.id, label: p.name}))} />`
3. Replace BU Select → `<Combobox options={businessUnits.map(bu => ({value: bu.id, label: `${bu.code} – ${bu.name}`}))} />`
4. Replace currency Select → `<Combobox options={currencies.map(c => ({value: c.id, label: `${c.symbol} ${c.code}`}))} />`
5. Keep type Select as-is (only 2 options, no search needed)
6. Replace amount `<Input type="number">` → `<NumberInput decimals={4} />`
7. Replace date `<Input type="date">` → `<DatePicker />`

### transaction-form.tsx
1. Same pattern for BU, currency, party selects → Combobox
2. Keep type and paymentMethod as Select (2 options each)
3. Replace amountOriginal → `<NumberInput decimals={4} />`
4. Replace exchangeRate → `<NumberInput decimals={8} />`
5. Replace amountVnd readonly → `<NumberInput readOnly decimals={4} />`
6. Replace transactionDate → `<DatePicker />`
7. Deposit select: keep as Select (shows remaining balance, not searchable)

### payment-form.tsx
1. Keep paymentType and paymentMethod as Select (2 options each)
2. Deposit select: keep as Select (contextual data)
3. Replace amountOriginal → `<NumberInput decimals={4} />`
4. Replace exchangeRate → `<NumberInput decimals={8} />`
5. Replace amountVnd readonly → `<NumberInput readOnly decimals={4} />`
6. Replace transactionDate → `<DatePicker />`

### deposit-form.tsx
1. Replace currency Select → Combobox
2. Replace BU Select → Combobox
3. Replace amount `<Input type="number">` → `<NumberInput decimals={2} />`

### party-form.tsx
1. Replace BU Select → Combobox
2. Keep type Select (3 options, no search needed)

## Rules
- Selects with ≤3 static options stay as Select (type, paymentMethod, partyType)
- Entity lookups (party, BU, currency, deposit) → Combobox
- All `type="number"` → NumberInput with appropriate decimal config
- All `type="date"` → DatePicker

## Todo List

- [x] Update order-form.tsx
- [x] Update transaction-form.tsx
- [x] Update payment-form.tsx
- [x] Update deposit-form.tsx
- [x] Update party-form.tsx
- [x] Run build to verify no compile errors
- [x] Visual check: combobox shows labels, numbers format correctly

## Success Criteria

- [x] All entity selects are searchable via Combobox
- [x] All number fields show thousands separators on blur
- [x] All date fields use calendar picker
- [x] Static-option selects (type, method) remain as Select
- [x] No compile errors, no regressions

## Completion Summary

Phase 2 successfully integrated new form controls across all 5 form components:

1. **order-form.tsx**: Applied Combobox to party/BU/currency selects, DatePicker to orderDate, NumberInput (decimals=4) to amountOriginal.

2. **transaction-form.tsx**: Applied Combobox to BU/currency/party selects, DatePicker to transactionDate, NumberInput with appropriate decimals to amountOriginal (4), exchangeRate (8), and amountVnd (4, read-only).

3. **payment-form.tsx**: Applied Combobox to relevant selects, DatePicker to transactionDate, NumberInput with same decimal configurations as transaction form.

4. **deposit-form.tsx**: Applied Combobox to currency/BU selects, NumberInput (decimals=2) to amountOriginal.

5. **party-form.tsx**: Applied Combobox to BU select.

Post-review fixes applied: Fixed deposits state reset on PaymentForm to prevent stale data after form submission.

All 5 forms tested and verified — no regressions observed.
