// Global Business Unit provider — single source of truth for selected BU across dashboard.
// Consumers use `useSelectedBu()` to read reactive value; changing BU in header auto-triggers
// re-fetch in any list/report page that has `selectedBuId` in its fetch deps.
// Also exposes `refetch()` so callers (e.g. BU settings page) can refresh the list
// after mutating BU config (orderNumberMode, name, etc.).
"use client";

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { getDefaultBu, saveSelectedBu } from "@/lib/utils";

export interface BusinessUnit {
  id: string;
  name: string;
  code?: string;
  currency?: string;
  orderNumberMode?: "MANUAL" | "AUTO";
}

interface BuContextValue {
  businessUnits: BusinessUnit[];
  selectedBuId: string;
  setSelectedBuId: (id: string) => void;
  isLoaded: boolean;
  refetch: () => Promise<void>;
}

const BuContext = createContext<BuContextValue | null>(null);

export function BuProvider({ children }: { children: ReactNode }) {
  const [businessUnits, setBusinessUnits] = useState<BusinessUnit[]>([]);
  const [selectedBuId, setSelectedBuIdState] = useState<string>("");
  const [isLoaded, setIsLoaded] = useState(false);

  // Fetch BU list; restore saved selection only on first load (subsequent refetches keep current selection)
  const loadBusinessUnits = useCallback(async (isInitial: boolean) => {
    try {
      const res = await fetch("/api/business-units");
      if (!res.ok) return;
      const json = await res.json();
      if (!json?.data?.length) return;
      setBusinessUnits(json.data);
      if (isInitial) {
        const saved = getDefaultBu();
        const resolved = saved && json.data.find((bu: BusinessUnit) => bu.id === saved)
          ? saved
          : json.data[0].id;
        setSelectedBuIdState(resolved);
        if (resolved !== saved) saveSelectedBu(resolved);
      }
    } catch {
      /* non-critical */
    } finally {
      if (isInitial) setIsLoaded(true);
    }
  }, []);

  useEffect(() => {
    loadBusinessUnits(true);
  }, [loadBusinessUnits]);

  const setSelectedBuId = useCallback((id: string) => {
    if (!id) return;
    setSelectedBuIdState(id);
    saveSelectedBu(id);
  }, []);

  const refetch = useCallback(async () => {
    await loadBusinessUnits(false);
  }, [loadBusinessUnits]);

  return (
    <BuContext.Provider value={{ businessUnits, selectedBuId, setSelectedBuId, isLoaded, refetch }}>
      {children}
    </BuContext.Provider>
  );
}

export function useSelectedBu(): BuContextValue {
  const ctx = useContext(BuContext);
  if (!ctx) {
    throw new Error("useSelectedBu must be used within <BuProvider>");
  }
  return ctx;
}
