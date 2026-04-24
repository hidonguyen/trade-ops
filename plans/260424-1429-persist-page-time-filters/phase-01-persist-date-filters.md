---
phase: 1
status: completed
priority: medium
effort: S
---

# Phase 1 — Persist Per-Page Date Filters

## Overview
Save `dateFrom` / `dateTo` per page in localStorage; restore on mount with `getThisWeekRange()` as fallback. Zero behavior change on first visit.

## Context
- Existing pattern: `lib/utils.ts` → `getDefaultBu` / `saveSelectedBu` (SSR-safe localStorage helper for BU selector).
- Existing default: `getThisWeekRange()` from `components/shared/date-quick-presets.tsx`.
- Current init on each page:
  ```ts
  const [filters, setFilters] = useState<Record<string,string>>(getThisWeekRange);
  ```
  (Except dashboard which uses `thirtyDaysAgo` ad-hoc inline — keep as-is, see Note below.)

## Requirements

### Functional
- R1. On page mount, if localStorage has a stored range for that `pageKey` → use it; else use `getThisWeekRange()`.
- R2. Whenever `filters.dateFrom` or `filters.dateTo` changes → persist to localStorage.
- R3. Keys scoped per page — changing filter on `/orders` must NOT affect `/transactions`.
- R4. SSR-safe (Next.js client component hydration; guard `typeof window`).
- R5. Corrupt / invalid stored JSON → silently fall back to default.

### Non-functional
- No flash of default then switch — initialize from localStorage in `useState` initializer (synchronous).
- No extra re-renders vs. current code.
- No new dependency.

## Architecture

### New helper: `lib/persisted-filters.ts`
```ts
const KEY_PREFIX = "trade-ops:filter";

export interface DateRange { dateFrom: string; dateTo: string; }

function storageKey(pageKey: string): string {
  return `${KEY_PREFIX}:${pageKey}:date`;
}

/** Read saved date range (SSR-safe). Returns null if missing/invalid. */
export function readPersistedDateRange(pageKey: string): DateRange | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(storageKey(pageKey));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.dateFrom === "string" && typeof parsed?.dateTo === "string") {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

/** Persist date range. No-op on SSR. */
export function writePersistedDateRange(pageKey: string, range: DateRange): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(storageKey(pageKey), JSON.stringify(range));
  } catch {
    // quota / private mode — silent
  }
}
```

### Hook option (preferred over manual wiring — keeps page code concise):
```ts
// components/shared/use-persisted-date-range.ts
"use client";
import { useEffect } from "react";
import { getThisWeekRange } from "@/components/shared/date-quick-presets";
import {
  readPersistedDateRange,
  writePersistedDateRange,
  type DateRange,
} from "@/lib/persisted-filters";

/** Initial range: stored value OR this-week fallback. Safe for useState initializer. */
export function getInitialDateRange(pageKey: string): DateRange {
  return readPersistedDateRange(pageKey) ?? getThisWeekRange();
}

/** Persist when dateFrom/dateTo change. */
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
```

### Page usage pattern (replaces `useState(getThisWeekRange)`):
```ts
const [filters, setFilters] = useState<Record<string,string>>(
  () => ({ ...getInitialDateRange("orders") }) // spread preserves existing init extras
);
usePersistDateRange("orders", filters.dateFrom, filters.dateTo);
```

For pages whose initializer merges URL params (e.g. `orders` reads `type` / `partyId`):
```ts
const [filters, setFilters] = useState<Record<string,string>>(() => {
  const type = searchParams.get("type");
  const partyId = searchParams.get("partyId");
  return {
    ...getInitialDateRange("orders"),
    ...(type ? { type } : {}),
    ...(partyId ? { partyId } : {}),
  };
});
```

## Related Code Files

### Create
- `lib/persisted-filters.ts` — storage helpers.
- `components/shared/use-persisted-date-range.ts` — `getInitialDateRange` + `usePersistDateRange` hook.

### Modify
- `app/(dashboard)/orders/page.tsx` — swap init + add hook (pageKey `orders`).
- `app/(dashboard)/transactions/page.tsx` — same (`transactions`).
- `app/(dashboard)/reports/cashflow/page.tsx` — same (`cashflow`).
- `app/(dashboard)/reports/summary/page.tsx` — same (`summary`).
- `app/(dashboard)/reports/bank-fees/page.tsx` — same (`bank-fees`).
- `app/(dashboard)/reports/deposits/page.tsx` — same (`deposits`).
- `app/(dashboard)/settings/audit-logs/page.tsx` — same (`audit-logs`).
- `app/(dashboard)/page.tsx` — dashboard uses ad-hoc 30-day default in a button handler, not in the main filter state. **Skip unless the page actually holds `dateFrom/dateTo` in state that the user edits** — re-read before editing. If no user-editable date filter on dashboard, drop from scope.

### Delete
- None.

## Implementation Steps

1. Create `lib/persisted-filters.ts` with `readPersistedDateRange` / `writePersistedDateRange` (SSR-safe, try/catch).
2. Create `components/shared/use-persisted-date-range.ts` exporting `getInitialDateRange(pageKey)` and `usePersistDateRange(pageKey, dateFrom, dateTo)`.
3. For each affected page:
   - Import both helpers.
   - Replace `useState<Record<string,string>>(getThisWeekRange)` with `useState<Record<string,string>>(() => ({ ...getInitialDateRange("<pageKey>") }))` (preserving any URL-param init logic already present).
   - Add `usePersistDateRange("<pageKey>", filters.dateFrom, filters.dateTo)` just after the `useState`.
   - Keep `getThisWeekRange` import removed if unused (but the helper still uses it internally; imports in page likely not needed anymore).
4. Verify dashboard page: inspect `app/(dashboard)/page.tsx` — if `dateFrom/dateTo` are only used inside an export button and not kept in state, **skip dashboard** and note in plan.
5. Run `npm run type-check` — fix any TS issues.
6. Manual smoke test per page:
   - Change date range → navigate to a detail page → come back → confirm range preserved.
   - Clear localStorage → revisit page → confirm defaults to "Tuần này".
   - Navigate from `/orders` to `/transactions` → confirm each page restores its own range (not shared).
7. Run `npm run lint`.

## Todo List

- [x] Create `lib/persisted-filters.ts`
- [x] Create `components/shared/use-persisted-date-range.ts`
- [x] Wire `/orders`
- [x] Wire `/transactions`
- [x] Wire `/reports/cashflow`
- [x] Wire `/reports/summary`
- [x] Wire `/reports/bank-fees`
- [x] Wire `/reports/deposits`
- [x] Wire `/settings/audit-logs`
- [x] Decide dashboard scope — **dropped** (no editable date-filter state; only ad-hoc `dateFrom/dateTo` inside a button onClick that builds a URL)
- [x] `npm run type-check` — no new errors (single pre-existing `.next/types` stale-path error present on main before changes)
- [x] `npm run lint` — no new errors on touched files (repo has many pre-existing lint issues unrelated)
- [ ] Manual smoke test — requires user to run dev server and verify in browser

## Followup Notes

- Code review verdict: APPROVE_WITH_MINOR_FIXES.
- MEDIUM (theoretical): hydration mismatch risk — `getInitialDateRange` reads localStorage inside `useState` initializer. All touched pages are `"use client"` and use `useSearchParams`, which already opts out of static prerender, so risk is likely nil. Verify dev console on first load if concerned.
- LOW: first mount writes the just-read range back to storage (redundant, benign).

## Success Criteria

- Changing date range on any list/report page and navigating away + back restores the last selected range.
- Each page's range is independent of the others.
- First visit (no storage) still shows "Tuần này".
- Full page reload restores the saved range (localStorage, not sessionStorage).
- No TS / lint errors. No console warnings on hydration.

## Risk Assessment

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Hydration mismatch (SSR renders default, client reads localStorage) | Low | Pages are `"use client"`; `useState` runs on client only. No SSR render of filter values from storage. |
| Stored garbage crashes page | Low | Try/catch + validation in `readPersistedDateRange`. |
| User sets date far in past, forgets — data looks empty | Low | Expected behavior; user can click "Tuần này" preset to reset. |
| localStorage quota in private-browsing / Safari ITP | Very Low | `writePersistedDateRange` swallows errors. |
| Sharing key collisions with future features | Low | Prefix `trade-ops:filter:<pageKey>:date` is unique enough. |

## Security Considerations
- No sensitive data; only date strings.
- No XSS vector — values only fed back into the same page state; never rendered as HTML.

## Next Steps
- Could later extend the helper to persist other filters (status, currencyId) using a generic `persistFilters(pageKey, keys, filters)` — out of scope now (YAGNI).
