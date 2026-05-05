# Phase 2 — Wire OrderLinkCell + Reports Layout

## Update `components/reports/order-link-cell.tsx`

```tsx
"use client";
import { ExternalLinkIcon } from "lucide-react";
import { useOrderDetailModal } from "./order-detail-modal-provider";

export function OrderLinkCell({ orderId }: { orderId: string | null | undefined }) {
  const modal = useOrderDetailModal();
  if (!orderId) return <span className="text-gray-300">—</span>;
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); modal.open(orderId); }}
      className="inline-flex items-center text-blue-600 hover:text-blue-800"
      title="Xem chi tiết đơn hàng"
    >
      <ExternalLinkIcon className="w-4 h-4" />
    </button>
  );
}
```

## Add provider to reports layout

Check if `app/(dashboard)/reports/layout.tsx` exists.
- **Exists:** wrap children with `<OrderDetailModalProvider>`.
- **Missing:** create:

```tsx
"use client";
import { OrderDetailModalProvider } from "@/components/reports/order-detail-modal-provider";

export default function ReportsLayout({ children }: { children: React.ReactNode }) {
  return <OrderDetailModalProvider>{children}</OrderDetailModalProvider>;
}
```

This wraps all 3 reports (summary, cashflow, deposits) automatically — no per-page changes.

## Todo
- [ ] Update `OrderLinkCell` to use modal context
- [ ] Create or update `app/(dashboard)/reports/layout.tsx` to wrap with provider
- [ ] Manual test on each of 3 reports: click icon → modal opens, page below blocked, close → restored
- [ ] Esc key closes modal
- [ ] Click overlay closes modal
- [ ] "Mở trang đầy đủ" link works

## Success Criteria
- 3 reports work without any per-page changes (provider in layout).
- Modal blocks interaction with report page (Dialog default behavior).
- No console errors.
