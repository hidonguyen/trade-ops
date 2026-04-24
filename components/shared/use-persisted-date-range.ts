// Hook + initializer helpers for persisting per-page date-range filter to localStorage.
"use client";

import { useEffect } from "react";
import { getThisWeekRange } from "@/components/shared/date-quick-presets";
import {
  readPersistedDateRange,
  writePersistedDateRange,
  type DateRange,
} from "@/lib/persisted-filters";

/**
 * Initial date range for a page: previously saved value or this-week fallback.
 * Safe to call from within useState initializer — sync, no effects, SSR-safe.
 */
export function getInitialDateRange(pageKey: string): DateRange {
  return readPersistedDateRange(pageKey) ?? getThisWeekRange();
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
