---
phase: 3
title: Deposit UI
status: completed
priority: P2
effort: 2h
dependencies:
  - 2
---

# Phase 3: Deposit UI

## Overview

Add date + exchange-rate inputs to the deposit create form and edit dialog, and show both on the deposit list table. Switch the list "Ngày" column from `createdAt` to `depositDate`.

## Requirements

- Functional:
  - Create form: a date picker (default today) and an exchange-rate number input (default 1).
  - Edit dialog: prefill + edit both fields; always editable (not usage-locked).
  - List: "Ngày" column renders `depositDate`; add a "Tỉ giá" column.
- Non-functional: reuse existing primitives (`NumberInput`, date input pattern used elsewhere); keep components ≤200 lines where practical.

## Architecture

- Use the existing canonical date control `DatePicker` from `@/components/ui/date-picker` (value = ISO `YYYY-MM-DD` string, `onChange(value)`), exactly as the order form does: `components/order-form.tsx:263` `<DatePicker value={form.orderDate} onChange={...} />` (import at `order-form.tsx:14`). Do NOT hand-roll a native `<input type="date">` — that primitive is not used anywhere in the app (the summary filter's `type: "date"` is a filter-config literal, not a DOM element) and would be visually inconsistent.
- `exchangeRate` uses `NumberInput` with `decimals={8}` (mirror order form), default `"1"`.
- `EnrichedDeposit` interface (`components/deposit-edit-dialog.tsx:23-33`) must gain `depositDate: string` and `exchangeRate: string`; the `Deposit` interface in `deposit-list.tsx:14` extends it and already adds `createdAt`.

## Related Code Files

- Modify: `components/deposit-form.tsx` — add `depositDate` (default today) + `exchangeRate` (default "1") state, inputs, and POST body
- Modify: `components/deposit-edit-dialog.tsx` — extend `EnrichedDeposit`, prefill (lines 61-69), inputs, PATCH diff body (lines 110-117)
- Modify: `components/deposit-list.tsx` — change "Ngày" column key `createdAt` → `depositDate` (line 91); add "Tỉ giá" column

## Implementation Steps

1. **`deposit-form.tsx`**:
   - Add state: `const [depositDate, setDepositDate] = useState(() => new Date().toISOString().slice(0,10));` and `const [exchangeRate, setExchangeRate] = useState("1");`
   - Reset() restores both to defaults.
   - Add a "Ngày đặt cọc" field using `<DatePicker value={depositDate} onChange={setDepositDate} />` and a "Tỉ giá" `NumberInput` (decimals 8, min 0) in the dialog body (place date near top, rate near amount).
   - Include `depositDate, exchangeRate` in the POST JSON body (line 72).
2. **`deposit-edit-dialog.tsx`**:
   - Extend `EnrichedDeposit` with `depositDate: string; exchangeRate: string;`.
   - Add state + prefill from `deposit.depositDate` (slice to `yyyy-mm-dd`) and `deposit.exchangeRate`.
   - Add the two inputs (`DatePicker` + rate `NumberInput`), always enabled — no `locked` disable (per Phase 2 edit policy).
   - Extend the changed-fields diff body: `if (depositDate !== <prefilled>) body.depositDate = depositDate;` and same for `exchangeRate`.
3. **`deposit-list.tsx`**:
   - Add `depositDate: string` and `exchangeRate: string` to the `Deposit` interface (via `EnrichedDeposit`).
   - Change the "Ngày" column `key: "createdAt"` → `key: "depositDate"` (line 91). Render from the date-only slice to avoid any timezone day-shift: `render: (v) => { const [y,m,d] = String(v).slice(0,10).split("-"); return `${d}/${m}/${y}`; }` (the value is a `YYYY-MM-DD`-prefixed ISO string; slicing sidesteps `new Date(...).toLocaleDateString` UTC-midnight drift).
   - Add a "Tỉ giá" column after currency/amount: `render: (v) => Number(v).toLocaleString("vi-VN", { maximumFractionDigits: 8 })`. Optionally hide when rate === 1 to reduce noise (show "—").
4. Run `npm run type-check` and `npm run lint`. Visually verify create/edit/list in the party detail page.

## Success Criteria

- [ ] Create form captures date (default today) + rate (default 1) and persists them
- [ ] Edit dialog prefills + saves both fields; editable even when deposit has usages
- [ ] List shows `depositDate` in "Ngày" and a "Tỉ giá" column
- [ ] `npm run type-check` + `npm run lint` pass

## Risk Assessment

- Risk: rendering `depositDate` via `new Date(iso).toLocaleDateString` could day-shift for negative-offset locales → mitigated by slice-based render (step 3). Vietnam is UTC+7 so same-day anyway, but slice is robust.
- Risk: `DatePicker` value semantics → none; it already emits/accepts ISO `YYYY-MM-DD` (`order-form.tsx:263` precedent), so no native-input fallback is needed.

## Security Considerations

None — client inputs re-validated server-side in Phase 2.

## Next Steps

Independent of Phase 4; both complete the feature.
