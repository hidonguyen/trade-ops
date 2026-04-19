# Transaction Filters + Date Quick Presets

**Created:** 2026-04-19
**Status:** completed
**Priority:** medium
**Complexity:** medium (4-5 files)

## Summary

1. Add date range + bankReference search filters to standalone transactions list
2. Create reusable date quick-preset component (hôm nay, hôm qua, tuần này, etc.)
3. Add quick presets to all pages with date filters

## Pages with Date Filters

| Page | Has dateFrom/To | Needs Quick Presets |
|------|----------------|---------------------|
| `/reports/cashflow` | yes | yes |
| `/reports/summary` | yes | yes |
| `/reports/bank-fees` | yes | yes |
| `/settings/audit-logs` | yes | yes |
| `/orders` | yes (dateFrom/dateTo) | yes |
| `/transactions` | **no — needs adding** | yes |
| `/` (dashboard) | yes | yes |

## Phases

| # | Phase | Status | Files |
|---|-------|--------|-------|
| 1 | [Transaction list filters](./phase-01-transaction-filters.md) | pending | transactions API + page |
| 2 | [Date quick-preset component](./phase-02-date-quick-presets.md) | pending | shared component, all pages with date filters |

## Key Decisions

- Quick presets as a reusable component `DateQuickPresets` — sets both dateFrom + dateTo
- Presets: Hôm nay, Hôm qua, Tuần này, Tuần trước, Tháng này, Tháng trước, Năm nay, Năm trước
- Renders as a row of small pill buttons above or next to the date pickers
- Component receives `onSelect(dateFrom, dateTo)` callback
- Integrates into FilterBar or placed adjacent to it on each page

## Dependencies
- None
