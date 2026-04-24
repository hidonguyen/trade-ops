// Per-page filter persistence helpers (localStorage, SSR-safe).
// Keeps filter selections (currently just date range) across navigation + reload.

const KEY_PREFIX = "trade-ops:filter";

export interface DateRange {
  dateFrom: string;
  dateTo: string;
}

function dateStorageKey(pageKey: string): string {
  return `${KEY_PREFIX}:${pageKey}:date`;
}

/** Read saved date range for a page. Returns null if missing, invalid, or SSR. */
export function readPersistedDateRange(pageKey: string): DateRange | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(dateStorageKey(pageKey));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (
      parsed &&
      typeof parsed === "object" &&
      typeof (parsed as DateRange).dateFrom === "string" &&
      typeof (parsed as DateRange).dateTo === "string"
    ) {
      return { dateFrom: (parsed as DateRange).dateFrom, dateTo: (parsed as DateRange).dateTo };
    }
    return null;
  } catch {
    return null;
  }
}

/** Persist date range for a page. No-op on SSR or storage failure (quota, ITP). */
export function writePersistedDateRange(pageKey: string, range: DateRange): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(dateStorageKey(pageKey), JSON.stringify(range));
  } catch {
    // quota / private mode — silent
  }
}
