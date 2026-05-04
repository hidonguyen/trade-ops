# Phase 03 — UI: expandable master-detail rendering

## File
- `app/(dashboard)/reports/deposits/page.tsx`

## Steps

1. **Replace flat `DepositEvent[]` interface với master-detail shape**:
   ```ts
   interface DepositUsage {
     id: string;
     createdAt: string;
     amountOriginal: string;
     eventType: "DEPOSIT_USED" | "DEPOSIT_REFUNDED";
     reference: string | null;
   }
   interface DepositMaster {
     id: string;
     createdAt: string;
     source: string;
     partyId: string;
     partyName: string;
     partyType: string;
     buCode: string;
     currencyCode: string;
     currencySymbol: string;
     amountOriginal: string;
     remainingOriginal: string;
     notes: string | null;
     usages: DepositUsage[];
   }
   ```

2. **Update fetch handler**: response is `json.data.deposits` instead of `json.data`.

3. **Render approach** — KISS: replace `DataTable` với custom expandable list. For each Deposit:
   - Master row (always visible): Ngày, Đối tác, source badge, Đặt cọc (initial amount), Số dư còn lại, Ghi chú, Đơn vị, expand toggle
   - On expand → table of usages: Ngày, Loại (Trừ/Hoàn), Số tiền, Tham chiếu

4. **State**: `const [expanded, setExpanded] = useState<Set<string>>(new Set())` keyed by deposit.id.

5. **Pseudo-render**:
   ```tsx
   <div className="rounded-lg border bg-white">
     <table className="w-full text-sm">
       <thead className="bg-slate-50 text-slate-600">
         <tr>
           <th>Ngày</th>
           <th>Đối tác</th>
           <th>Loại nguồn</th>
           <th className="text-right">Đặt cọc</th>
           <th className="text-right">Số dư</th>
           <th>Tiền tệ</th>
           <th>Đơn vị</th>
           <th>Ghi chú</th>
           <th></th>
         </tr>
       </thead>
       <tbody>
         {deposits.map((d) => (
           <Fragment key={d.id}>
             <tr onClick={() => toggle(d.id)} className="cursor-pointer hover:bg-slate-50 border-t">
               <td>{formatDate(d.createdAt)}</td>
               <td>{d.partyName}</td>
               <td>{d.source === "REFUND" ? <Badge>Hoàn từ GD</Badge> : <Badge>Đặt cọc</Badge>}</td>
               <td className="text-right"><CurrencyAmount ... amount={d.amountOriginal} /></td>
               <td className="text-right"><CurrencyAmount ... amount={d.remainingOriginal} /></td>
               <td>{d.currencyCode}</td>
               <td>{d.buCode}</td>
               <td>{d.notes ?? "—"}</td>
               <td>{expanded.has(d.id) ? "▾" : "▸"}</td>
             </tr>
             {expanded.has(d.id) && d.usages.length > 0 && (
               <tr><td colSpan={9} className="bg-slate-50 p-3">
                 <table className="w-full text-sm">
                   <thead><tr>...</tr></thead>
                   <tbody>
                     {d.usages.map((u) => (
                       <tr key={u.id}>
                         <td>{formatDate(u.createdAt)}</td>
                         <td>{u.eventType === "DEPOSIT_USED" ? "Trừ cọc" : "Hoàn cọc"}</td>
                         <td className="text-right">
                           <CurrencyAmount amount={u.amountOriginal} currencyCode={d.currencyCode} currencySymbol={d.currencySymbol} />
                         </td>
                         <td>{u.reference ?? "—"}</td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
               </td></tr>
             )}
             {expanded.has(d.id) && d.usages.length === 0 && (
               <tr><td colSpan={9} className="bg-slate-50 px-4 py-2 text-slate-500 italic">Chưa có giao dịch trừ/hoàn</td></tr>
             )}
           </Fragment>
         ))}
       </tbody>
     </table>
   </div>
   ```

6. **Loading + empty state**: handle `loading` (skeleton), empty (`Không có cọc nào trong kỳ này`).

7. **File size guard**: Page hiện 186 lines. Sau khi rewrite có thể vượt 250. Nếu >300, modularize thành `deposit-master-row.tsx` + `deposit-usage-list.tsx`.

8. Compile check + visual smoke.

## Todo
- [ ] Update interfaces
- [ ] Update fetch to consume `data.deposits`
- [ ] Implement expandable row state
- [ ] Render master + detail tables
- [ ] Empty/loading states
- [ ] Compile check

## Success
- 1 row per deposit; expand toggles detail.
- REFUND-source deposit shows "Hoàn từ GD" badge.
- Sort asc visible.
- Detail rows show only post-seed usages.

## Risk
- **Table semantics**: nested table inside td works visually but semantically odd. Acceptable for KISS. Alternative: render as <div>-based grid if styling issues.
