// Hook + initializer helpers for persisting per-page date-range filter to localStorage.
"use client";

import { useEffect, useRef } from "react";
import { getThisWeekRange } from "@/components/shared/date-quick-presets";
import {
  readPersistedDateRange,
  writePersistedDateRange,
  type DateRange,
} from "@/lib/persisted-filters";

/**
 * SSR-safe initial date range — always returns this-week fallback.
 * Persisted localStorage value (if any) is restored post-mount via
 * `useRestorePersistedDateRange` to avoid React hydration mismatches.
 */
export function getInitialDateRange(_pageKey: string): DateRange {
  return getThisWeekRange();
}

/**
 * After mount, read persisted range from localStorage and apply via callback.
 * Runs once. No-op if nothing persisted or if persisted value matches default.
 */
export function useRestorePersistedDateRange(
  pageKey: string,
  applyRange: (range: DateRange) => void,
): void {
  const appliedRef = useRef(false);
  useEffect(() => {
    if (appliedRef.current) return;
    appliedRef.current = true;
    const persisted = readPersistedDateRange(pageKey);
    if (persisted) applyRange(persisted);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageKey]);
}

/**
 * Persist date range whenever it changes. Pass the current filter dateFrom/dateTo.
 * Skips writing when either value is empty to avoid overwriting with partial state.
 */
export function usePersistDateRange(
  pageKey: string,
  dateFrom: string | undefined,
  dateTo: string | undefined,
): void {
  useEffect(() => {
    if (!dateFrom || !dateTo) return;
    writePersistedDateRange(pageKey, { dateFrom, dateTo });
  }, [pageKey, dateFrom, dateTo]);
}
