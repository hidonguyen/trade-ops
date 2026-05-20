// usePrefill — read-once sessionStorage hook used by /orders/new and /transactions/new
// to absorb a copied payload from a list row. Clears after read so a refresh doesn't
// resurrect stale values.
"use client";

import { useEffect, useState } from "react";

export const PREFILL_KEYS = {
  order: "trade-ops:prefill:order",
  transaction: "trade-ops:prefill:transaction",
} as const;

export function setPrefill(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore quota / privacy mode errors
  }
}

export function usePrefill<T>(key: string): T | null {
  const [data, setData] = useState<T | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.sessionStorage.getItem(key);
      if (!raw) return;
      window.sessionStorage.removeItem(key);
      setData(JSON.parse(raw) as T);
    } catch {
      window.sessionStorage.removeItem(key);
    }
  }, [key]);
  return data;
}
