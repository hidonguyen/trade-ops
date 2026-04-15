# Phase 07 — Dashboard KPI card: bank fees this period

## Overview
- Priority: Medium
- Status: pending
- Depends on: Phase 02

## Requirements

- New KPI card on `/` (dashboard): "Phí ngân hàng" — total `bankFeeVnd` in current period (matches existing period selector).
- Link-through to `/reports/bank-fees` with same period pre-filled.
- Shown to all users with dashboard access.

## Files

- `app/api/reports/dashboard/route.ts` — add `totalBankFeeVnd` to response.
- `app/(dashboard)/page.tsx` — add KPI card component.

## Steps

1. Extend dashboard API query to SUM `bankFeeVnd` within period.
2. Add KPI card with icon + formatted VND amount.
3. Clicking card navigates to `/reports/bank-fees?from=...&to=...`.
4. Type-check + visual test.

## Todo

- [ ] API returns `totalBankFeeVnd`
- [ ] KPI card rendered in dashboard grid
- [ ] Click-through works with query params
- [ ] Period selector change updates KPI

## Success Criteria

- KPI matches sum of fees in dedicated report for same period.
- No KPI flicker / layout shift when added.

## Risks

- Empty period → 0, must not show "NaN" or blank.

## Next

All phases done → integration test + update `./docs/project-changelog.md`.
