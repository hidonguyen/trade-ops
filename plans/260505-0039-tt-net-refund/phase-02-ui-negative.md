# Phase 02 — UI: negative periodPayment + cleanup refund rowType

## File
- `app/(dashboard)/reports/summary/page.tsx`

## Steps

1. **Drop `"refund"` from `rowType` union** in `StandaloneRow` interface.
2. **Drop refund branch in Loại column renderer** (the `text-orange-600` line).
3. **periodPayment column** — current renderer wraps in `<span className="text-green-700 font-medium">`. Make it sign-aware:
   ```tsx
   render: (v, row) => {
     const num = parseFloat(v as string);
     const cls = num < 0 ? "text-red-600 font-medium" : "text-green-700 font-medium";
     return (
       <span className={cls}>
         <CurrencyAmount amount={v} currencyCode={row.currencyCode} currencySymbol={row.currencySymbol} />
       </span>
     );
   },
   ```
4. **Verify `<CurrencyAmount>`** renders negative numbers (sign preserved). If it strips sign, add `signed` prop or render manually. Quick check during compile.
5. Compile check.

## Todo
- [ ] Remove `"refund"` from rowType union
- [ ] Remove refund branch in Loại renderer
- [ ] Sign-aware color for periodPayment
- [ ] Verify CurrencyAmount handles negatives
- [ ] Compile

## Success
- `rowType="refund"` no longer appears anywhere.
- Order with refund-heavy period shows red `−15` in TT lần này.

## Next
- Optional QA: visual check on light/dark mode for red color contrast.
