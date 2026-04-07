---
status: completed
priority: high
complexity: low
blockedBy: []
blocks: []
---

# BU Global Storage + Menu Highlight Fix

Two independent fixes for UX issues.

## Problem Analysis

### 1. BU Not Persisted
- Header BU selector (`components/layout/header.tsx:43`) resets on page reload
- Forms each fetch BU list independently, no default from global selection
- No localStorage/global state for BU

### 2. Menu Items Highlight Together
- Sidebar (`components/layout/sidebar.tsx:94-95`) strips query params: `basePath = item.href.split("?")[0]`
- `/orders?type=SALE` and `/orders?type=PURCHASE` both resolve to `/orders` → both highlight
- Same for `/parties?type=CUSTOMER` and `/parties?type=SUPPLIER` → both highlight
- Pages don't read `type` from URL search params as initial filter value

## Phases

| # | Phase | Status | Files |
|---|-------|--------|-------|
| 1 | [Menu highlight fix](phase-01-menu-highlight-fix.md) | completed | `sidebar.tsx`, `orders/page.tsx`, `parties/page.tsx` |
| 2 | [BU global storage](phase-02-bu-global-storage.md) | completed | `header.tsx`, `order-form.tsx`, `party-form.tsx`, `transaction-form.tsx`, `deposit-form.tsx` |
