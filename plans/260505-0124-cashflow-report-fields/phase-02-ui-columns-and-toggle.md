# Phase 02 — UI: cột mới + signed amount + toggle DEPOSIT

## File
- `app/(dashboard)/reports/cashflow/page.tsx`

## Steps

1. **Update `CashflowTransaction` interface** với fields mới: `paymentType`, `partyName`, `expenseTypeName`, `orderNumber`, `createdBy`.

2. **Add toggle state**:
   ```ts
   const [includeDeposit, setIncludeDeposit] = useState(false);
   ```
   Pass `includeDeposit: String(includeDeposit)` vào URLSearchParams. Add to dependency array.

3. **UI toggle** — checkbox đặt cạnh `DateQuickPresets`:
   ```tsx
   <label className="flex items-center gap-2 text-sm text-slate-600">
     <input type="checkbox" checked={includeDeposit}
       onChange={(e) => setIncludeDeposit(e.target.checked)} />
     Hiện giao dịch cọc
   </label>
   ```

4. **Signed amount helper**:
   ```ts
   function signedAmount(amount: string, paymentType: string): string {
     if (paymentType === "REFUND") return new Decimal(amount).negated().toString();
     return amount;
   }
   ```

5. **Final columns** (replace existing):
   ```
   STT | Ngày | Đơn vị | Loại | Loại GD | Đối tác | Loại chi | Mã đơn | PTTT | Nguyên tệ | Phí NH | Thực thu/chi | Quy đổi VND
   ```
   - **STT**: index từ DataTable (đã fix)
   - **Đơn vị**: `businessUnit.code`
   - **Loại GD**: badge — `PAYMENT="TT"`, `REFUND="Hoàn"`, `ADJUSTMENT="Đ/C"`
   - **Đối tác**: `partyName ?? "—"` (rỗng cho tx độc lập)
   - **Loại chi**: `expenseTypeName ?? "—"` (rỗng cho tx-gắn-đơn)
   - **Mã đơn**: `orderNumber ?? "—"`
   - **PTTT**: `BANK="Ngân hàng"`, `DEPOSIT="Cọc"`
   - **Nguyên tệ / Quy đổi VND / Thực thu/chi**: pass `signedAmount(...)` vào `CurrencyAmount`. CurrencyAmount đã red+dấu trừ cho số âm.

6. **Tooltip per row** — wrap row hoặc dùng title attribute:
   - `Tham chiếu: {bankReference || "—"}`
   - `Ghi chú: {notes || "—"}`
   - `Người tạo: {createdBy}`
   
   Đơn giản nhất: `<TableRow title={tooltipText}>`. Nếu DataTable không hỗ trợ row props, dùng cell title trên cột Loại GD.

7. **Update `computeSummaries`** — receipts/payments cộng raw amount; vì REFUND tx vẫn có amountOriginal dương trong DB, logic đảo direction (line 102-107) giữ nguyên. Confirm sau khi sign UI: aggregation không đổi.

## Todo
- [ ] Update CashflowTransaction interface
- [ ] Add includeDeposit state + URL param
- [ ] Add checkbox toggle UI
- [ ] Implement signedAmount helper
- [ ] Rewrite columns array (13 cột final)
- [ ] Add row tooltip với reference/notes/createdBy
- [ ] Compile check

## Success
- Toggle off: chỉ thấy BANK tx. Toggle on: cả Cọc.
- REFUND row hiển thị đỏ, có dấu `-`, badge "Hoàn".
- Tx độc lập có Loại chi (e.g. "Văn phòng phẩm"), không có Đối tác.
- Tx gắn đơn có Đối tác + Mã đơn, không có Loại chi.
- Hover row → tooltip hiện ref + notes + creator.
- Summary cards không thay đổi giá trị (chỉ tập tx hiển thị thay đổi theo toggle).

## Risks
- **DataTable row tooltip**: cần thêm prop `rowTitle`. Nếu phức tạp, fallback: tooltip trên cột Ghi chú-icon riêng.
