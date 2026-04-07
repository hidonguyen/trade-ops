---
status: planned
priority: high
complexity: low
blockedBy: []
blocks: []
---

# Hide BU Comboboxes — Use Global BU Automatically

Remove all BU selection UI from forms and filter bars. Auto-inject global BU (from header/localStorage) into API filter params and request bodies.

## Affected Files

### Forms (remove BU combobox, auto-inject in payload)
| File | What to do |
|------|------------|
| `components/order-form.tsx` | Remove BU combobox UI, remove BU state/fetch, auto-set from `getDefaultBu()` on submit |
| `components/party-form.tsx` | Same |
| `components/transaction-form.tsx` | Same — also uses BU to filter parties, keep that fetch logic |
| `components/deposit-form.tsx` | Same |

### Filter Bars (remove BU filter option, auto-inject in API calls)
| File | What to do |
|------|------------|
| `app/(dashboard)/orders/page.tsx` | Remove BU filter config, auto-add BU to fetch params |
| `app/(dashboard)/parties/page.tsx` | Same |
| `app/(dashboard)/transactions/page.tsx` | Same |
| `app/(dashboard)/cashflow/page.tsx` | Same |
| `app/(dashboard)/reports/page.tsx` | Remove BU filter, auto-inject in summary fetch |

### Dashboard
| File | What to do |
|------|------------|
| `app/(dashboard)/page.tsx` | Remove local BU dropdown, use global BU from localStorage |

## Phases

| # | Phase | Status | Scope |
|---|-------|--------|-------|
| 1 | [Forms](phase-01-forms-remove-bu.md) | planned | 4 form components |
| 2 | [Pages & filters](phase-02-pages-remove-bu-filter.md) | planned | 6 page components |
