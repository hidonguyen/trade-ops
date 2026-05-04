// Nav highlight provider — tracks transient context (e.g. order type on detail pages)
// so sidebar can highlight the correct menu item when URL lacks disambiguating params.
// Example: /orders/{id} has no ?type= param — detail page pushes order.type here after
// fetch, sidebar falls back to it when pathname.startsWith("/orders/").
// Same mechanism applies to /parties/{id} with party.type (CUSTOMER/SUPPLIER).
"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type OrderType = "SALE" | "PURCHASE" | null;
type PartyType = "CUSTOMER" | "SUPPLIER" | null;

interface NavHighlightCtx {
  orderDetailType: OrderType;
  setOrderDetailType: (t: OrderType) => void;
  partyDetailType: PartyType;
  setPartyDetailType: (t: PartyType) => void;
}

const Ctx = createContext<NavHighlightCtx | null>(null);

export function NavHighlightProvider({ children }: { children: ReactNode }) {
  const [orderDetailType, setOrderDetailType] = useState<OrderType>(null);
  const [partyDetailType, setPartyDetailType] = useState<PartyType>(null);
  return (
    <Ctx.Provider value={{ orderDetailType, setOrderDetailType, partyDetailType, setPartyDetailType }}>
      {children}
    </Ctx.Provider>
  );
}

export function useNavHighlight(): NavHighlightCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useNavHighlight must be used within <NavHighlightProvider>");
  return ctx;
}

/**
 * Helper for order detail/edit pages: pushes the order type into nav highlight context
 * while mounted, resets on unmount so stale value doesn't leak to other routes.
 */
export function useRegisterOrderDetailType(type: OrderType) {
  const { setOrderDetailType } = useNavHighlight();

  // Set on change
  useEffect(() => {
    if (type) setOrderDetailType(type);
  }, [type, setOrderDetailType]);

  // Reset on unmount
  useEffect(() => {
    return () => setOrderDetailType(null);
  }, [setOrderDetailType]);
}

/**
 * Helper for party detail/edit pages: same mechanism, pushes party.type
 * (CUSTOMER/SUPPLIER) so sidebar highlights Khách hàng / Nhà cung cấp.
 */
export function useRegisterPartyDetailType(type: PartyType) {
  const { setPartyDetailType } = useNavHighlight();

  useEffect(() => {
    if (type) setPartyDetailType(type);
  }, [type, setPartyDetailType]);

  useEffect(() => {
    return () => setPartyDetailType(null);
  }, [setPartyDetailType]);
}
