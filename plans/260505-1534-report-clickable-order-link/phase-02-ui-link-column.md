# Phase 2 — UI: trailing icon column on 3 reports

## Shared pattern
Reusable cell renderer (inline, no new module needed unless duplication is heavy):

```tsx
function OrderLinkCell({ orderId }: { orderId: string | null | undefined }) {
  if (!orderId) return <span className="text-gray-300">—</span>;
  return (
    <a
      href={`/orders/${orderId}`}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center text-blue-600 hover:text-blue-800"
      onClick={(e) => e.stopPropagation()}
      title="Mở đơn hàng (tab mới)"
    >
      <ExternalLinkIcon className="w-4 h-4" />
    </a>
  );
}
```

Use `lucide-react` `ExternalLink` icon if available (grep first); otherwise reuse existing icon set.

## Summary page
- File: `app/(dashboard)/reports/summary/page.tsx`
- 4 tables: customer receipts, other receipts, supplier payments, other payments.
- DebtRow tables: append column `{ key: "orderId", label: "", render: (_, row) => <OrderLinkCell orderId={row.orderId} /> }`.
- StandaloneRow tables: same column reading `row.orderId` (now nullable).

## Cashflow page
- File: `app/(dashboard)/reports/cashflow/page.tsx`
- Add `orderId: string | null` to `CashflowTransaction` interface.
- Append link column to `columns` array (after existing last column).

## Deposits page
- File: `app/(dashboard)/reports/deposits/page.tsx`
- Detail/usage table only (master row has no order). Append column to usage columns.

## Todo
- [ ] Inline `OrderLinkCell` in each page (or extract to `components/reports/order-link-cell.tsx` if 3 copies feel duplicated)
- [ ] Append column to: 4 summary tables, cashflow table, deposits usage table
- [ ] `npm run build` clean
- [ ] Manual smoke: click icon on order-linked row → opens `/orders/{id}` in new tab; standalone row shows `—`

## Success Criteria
- All 6 column locations show icon-or-dash correctly.
- Cmd/Ctrl-click respects `target=_blank` semantics (already default).
- No layout regressions (icon column narrow, ~40px).
