# Phase 03 — Excel export sync

## Files
- `lib/excel-export-service.ts` (cashflow tx renderer)
- `app/api/cashflow-report/route.ts` (passes data to renderer)

## Steps

1. **Pass `includeDeposit` to xlsx branch** — same query param affects export. Already filtered upstream in Phase 01 if findMany result drives `txRows` AND export uses `txRows`. Verify: line 142 `exportCashflowToExcel({ currencies, transactions: txRows })` — yes, uses filtered set.

2. **Extend `CashflowTransaction` interface** in `excel-export-service.ts:5-16` với:
   - `paymentType: string`
   - `partyName: string | null`
   - `expenseTypeName: string | null`
   - `orderNumber: string | null`
   - `createdBy: string`

3. **Add columns to renderer** — match UI layout. Excel keeps them all phẳng (không tooltip). Add: Đơn vị, Loại GD, Đối tác, Loại chi, Mã đơn, Tham chiếu, Ghi chú, Người tạo.

4. **Signed amount in Excel**: Amount cell as a Number (negative for REFUND). ExcelJS auto-formats âm với dấu `-`.

5. **VND** column tương tự, signed.

6. Compile check + thử export sample.

## Todo
- [ ] Verify includeDeposit propagates to xlsx
- [ ] Extend CashflowTransaction interface
- [ ] Add new columns in worksheet header + row mapper
- [ ] Apply signed amount logic for REFUND
- [ ] Compile check
- [ ] Sample export → eyeball row có REFUND show số âm

## Success
- Excel cashflow xls có 13+ columns matching UI.
- REFUND rows có amount âm.
- DEPOSIT-method tx vắng mặt khi `includeDeposit=false` (default).

## Risks
- **Excel summary sheet** (currencies aggregation) đã filter qua API — không cần đổi.
