---
name: Persist Page Time Filters
status: completed
priority: medium
complexity: low
created: 2026-04-24
completed: 2026-04-24
blockedBy: []
blocks: []
---

# Persist Per-Page Time Filters

Date filter values (`dateFrom` / `dateTo`) on list & report pages reset to "Tuần này" whenever the user leaves and returns. Persist them per page in localStorage so navigating away and coming back keeps the last selection.

## Summary

- Add one shared helper `usePersistedDateRange(pageKey)` in `lib/` (or `components/shared/`) that hydrates `{dateFrom,dateTo}` from localStorage and writes on change.
- Each page assigns a stable `pageKey` (e.g. `orders`, `transactions`, `cashflow`, `summary`, `bank-fees`, `deposits`, `dashboard`, `audit-logs`).
- Fallback when no stored value: current default `getThisWeekRange()`.
- Only date fields persisted — other filters (`status`, `partyId`, `type`…) stay session-scoped.

## Affected Pages (8)

| Page | File | pageKey |
|------|------|---------|
| Dashboard | `app/(dashboard)/page.tsx` | `dashboard` |
| Orders | `app/(dashboard)/orders/page.tsx` | `orders` |
| Transactions | `app/(dashboard)/transactions/page.tsx` | `transactions` |
| Cashflow report | `app/(dashboard)/reports/cashflow/page.tsx` | `cashflow` |
| Summary report | `app/(dashboard)/reports/summary/page.tsx` | `summary` |
| Bank fees report | `app/(dashboard)/reports/bank-fees/page.tsx` | `bank-fees` |
| Deposits report | `app/(dashboard)/reports/deposits/page.tsx` | `deposits` |
| Audit logs | `app/(dashboard)/settings/audit-logs/page.tsx` | `audit-logs` |

## Phases

| # | Phase | Status | Files |
|---|-------|--------|-------|
| 1 | [Persist per-page date filters](./phase-01-persist-date-filters.md) | completed | 2 new files + 7 page edits (dashboard dropped: no editable date state) |

## Key Decisions

- **Per-page scope** ("ở mỗi trang"): each page has its own localStorage key.
- **Storage**: `localStorage` (survives reload, same pattern as BU selector in `lib/utils.ts`).
- **Key namespace**: `trade-ops:filter:{pageKey}:date` storing JSON `{dateFrom,dateTo}`.
- **Default fallback**: `getThisWeekRange()` — no UX regression on first visit.
- **Only `dateFrom` / `dateTo`**: other filters remain non-persistent (YAGNI — user only asked for time filter).
- **SSR-safe**: guard `typeof window` like existing `getDefaultBu`.

## Dependencies
- None. Builds on existing `date-quick-presets.tsx` + `FilterBar` patterns.

## Out of Scope
- Persisting non-date filters (status, partyId, currencyId, etc.)
- URL-param sync for filters
- Global/cross-page shared filter state
