"use client";

import { createContext, useCallback, useContext, useState, ReactNode } from "react";
import { OrderDetailModal } from "./order-detail-modal";

interface Ctx {
  open: (orderId: string) => void;
  close: () => void;
}

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
