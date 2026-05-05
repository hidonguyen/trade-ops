# Phase 1 — Modal + Provider + Hook

## New file: `components/reports/order-detail-modal-provider.tsx`

```tsx
"use client";
import { createContext, useCallback, useContext, useState, ReactNode } from "react";
import { OrderDetailModal } from "./order-detail-modal";

interface Ctx { open: (orderId: string) => void; close: () => void; }
const OrderDetailModalCtx = createContext<Ctx | null>(null);

export function OrderDetailModalProvider({ children }: { children: ReactNode }) {
  const [orderId, setOrderId] = useState<string | null>(null);
  const open = useCallback((id: string) => setOrderId(id), []);
  const close = useCallback(() => setOrderId(null), []);
  return (
    <OrderDetailModalCtx.Provider value={{ open, close }}>
      {children}
      <OrderDetailModal orderId={orderId} onClose={close} />
    </OrderDetailModalCtx.Provider>
  );
}

export function useOrderDetailModal(): Ctx {
  const ctx = useContext(OrderDetailModalCtx);
  if (!ctx) throw new Error("useOrderDetailModal must be inside OrderDetailModalProvider");
  return ctx;
}
```

## New file: `components/reports/order-detail-modal.tsx`

```tsx
"use client";
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { OrderInfoCard } from "@/app/(dashboard)/orders/[id]/order-info-card";
import { FinancialSummaryCard } from "@/app/(dashboard)/orders/[id]/financial-summary-card";
import { OrderTransactionsTable } from "@/app/(dashboard)/orders/[id]/order-transactions-table";

interface Props { orderId: string | null; onClose: () => void; }

export function OrderDetailModal({ orderId, onClose }: Props) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!orderId) { setData(null); return; }
    setLoading(true);
    fetch(`/api/orders/${orderId}/report`)
      .then((r) => r.json())
      .then((res) => setData(res?.data ?? null))
      .finally(() => setLoading(false));
  }, [orderId]);

  return (
    <Dialog open={!!orderId} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogTitle>Chi tiết đơn hàng</DialogTitle>
        {loading || !data ? (
          <div className="space-y-3 py-4"><Skeleton className="h-24" /><Skeleton className="h-32" /></div>
        ) : (
          <div className="space-y-4">
            <OrderInfoCard order={data.order} />
            <FinancialSummaryCard summary={data.summary} currencyCode={data.order.currency.code} currencySymbol={data.order.currency.symbol} />
            <OrderTransactionsTable transactions={data.transactions} currencyCode={data.order.currency.code} currencySymbol={data.order.currency.symbol} readOnly />
            <div className="flex justify-end pt-2">
              <a href={`/orders/${data.order.id}`} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm">Mở trang đầy đủ ↗</Button>
              </a>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

## Component prop check
Inspect existing card components — they may currently get data from page state. If their props match (order, summary, transactions) the snippet above works as-is. If not, adjust prop shape OR pass the `OrderReport` directly.

If `OrderTransactionsTable` doesn't have a `readOnly` prop, add one (default false) that hides edit/delete buttons. Minimal touch.

## Todo
- [ ] Read 3 card components to confirm prop shapes
- [ ] Implement `OrderDetailModal` (adjust props if needed)
- [ ] Implement `OrderDetailModalProvider`
- [ ] If `OrderTransactionsTable` lacks `readOnly`, add it
- [ ] `tsc --noEmit` clean
