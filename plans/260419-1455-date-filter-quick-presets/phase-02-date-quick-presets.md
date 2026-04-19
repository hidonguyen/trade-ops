# Phase 02 — Date Quick-Preset Component

## Overview
- **Priority:** medium
- **Status:** pending
- Create reusable DateQuickPresets component, integrate into all pages with date filters

## Related Code Files
- `components/shared/date-quick-presets.tsx` — NEW component
- All pages with date filters (see plan.md table)

## Preset Definitions

| Label | dateFrom | dateTo |
|-------|----------|--------|
| Hôm nay | today | today |
| Hôm qua | yesterday | yesterday |
| Tuần này | startOfWeek(Mon) | today |
| Tuần trước | prevWeek Mon | prevWeek Sun |
| Tháng này | 1st of month | today |
| Tháng trước | 1st of prev month | last day of prev month |
| Năm nay | Jan 1 | today |
| Năm trước | Jan 1 prev year | Dec 31 prev year |

## Implementation Steps

### 1. Create DateQuickPresets component
File: `components/shared/date-quick-presets.tsx`

```tsx
interface DateQuickPresetsProps {
  onSelect: (dateFrom: string, dateTo: string) => void;
  activePreset?: string; // optional highlight
}
```

Renders as row of pill buttons. Each button calls `onSelect` with YYYY-MM-DD strings.
Use plain JS Date math — no date library needed.

### 2. Integrate into pages
For each page with date filters:
- Import DateQuickPresets
- Place above/below FilterBar
- `onSelect` sets both dateFrom + dateTo filter values

Pages: transactions, cashflow, summary, bank-fees, audit-logs, orders, dashboard

## Todo List
- [ ] Create DateQuickPresets component
- [ ] Integrate into transactions page
- [ ] Integrate into cashflow page
- [ ] Integrate into summary page
- [ ] Integrate into bank-fees page
- [ ] Integrate into audit-logs page
- [ ] Integrate into orders page
- [ ] Integrate into dashboard page
- [ ] Verify compile
