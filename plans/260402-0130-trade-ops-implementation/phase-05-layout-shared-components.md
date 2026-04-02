# Phase 5: Dashboard Layout + Shared Components

## Context Links
- [Design Guidelines](../../docs/design-guidelines.md) -- colors, typography, spacing, component patterns
- [Codebase Summary](../../docs/codebase-summary.md) -- component organization
- [Wireframe: Dashboard](../../docs/wireframes/01-dashboard.html)
- [Wireframe: Orders List](../../docs/wireframes/02-orders-list.html)

## Overview
- **Priority:** P1
- **Status:** Complete
- **Effort:** 5h
- **Blocked by:** Phase 1
- **Blocks:** Phases 6, 7, 8
- **Parallel with:** Phases 2, 3, 4
- **Description:** Build the dashboard shell layout (sidebar + header) and all reusable shared components (data table, pagination, status badge, currency amount display, filter bar, confirmation dialog). Install shadcn/ui primitives.

## Key Insights
- Sidebar: dark navy (#0F172A), 5 nav groups matching Vietnamese labels
- Header: white bg, sticky, BU selector pill, user dropdown
- Data table: generic, reusable with sorting/pagination props
- Currency amount: single column with inline symbol, IBM Plex Mono font
- All components must support responsive breakpoints (mobile sidebar collapse)
- shadcn/ui components: Button, Input, Select, Table, Dialog, Badge, DropdownMenu, Separator, Sheet (mobile sidebar)

## File Ownership (Exclusive)

```
app/(dashboard)/layout.tsx
components/layout/sidebar.tsx
components/layout/header.tsx
components/shared/data-table.tsx
components/shared/pagination.tsx
components/shared/status-badge.tsx
components/shared/currency-amount.tsx
components/shared/filter-bar.tsx
components/shared/confirmation-dialog.tsx
components/ui/*  (all shadcn/ui primitives)
```

## Implementation Steps

### 1. Install shadcn/ui Components (0.5h)
1. Install all needed primitives:
   ```
   button, input, select, table, dialog, badge, dropdown-menu,
   separator, sheet, card, label, textarea, toast, skeleton,
   popover, calendar, command
   ```
2. Verify theme matches design-guidelines.md color tokens

### 2. Dashboard Layout (1h)
1. `app/(dashboard)/layout.tsx`
   - Server component wrapping all dashboard pages
   - Fetch session via `auth()` -- redirect to /login if unauthenticated
   - Pass user data (name, roles) to header/sidebar via props
   - Layout structure: sidebar (fixed left) + main content (flex-1, scrollable)
   - CSS: `min-h-screen flex`

### 3. Sidebar Component (1h)
1. `components/layout/sidebar.tsx`
   - Dark navy background (#0F172A)
   - Logo/wordmark at top
   - 5 nav groups with Vietnamese labels:
     - Ban hang: Don ban, Khach hang
     - Mua hang: Don mua, Nha cung cap
     - Thu Chi: Giao dich, Bao cao dong tien
     - Bao cao: Tong hop
     - Cai dat: Nguoi dung, Cau hinh (ADMIN only)
   - Active state: bg-blue-700 text-white
   - Lucide icons (18px, stroke-width 1.5)
   - Mobile: Sheet component (hamburger toggle)
   - Collapsible: w-60 desktop, w-16 icon-only tablet, hidden+Sheet mobile
   - RBAC-aware: hide nav items user cannot access

### 4. Header Component (0.5h)
1. `components/layout/header.tsx`
   - Sticky top, h-14, white bg, border-bottom
   - Left: mobile hamburger, BU selector dropdown (pill style)
   - Right: user name, role badge, logout button
   - BU selector fetches from /api/business-units, stores in context/cookie

### 5. Data Table Component (1h)
1. `components/shared/data-table.tsx`
   - Generic props: `columns: Column[]`, `data: T[]`, `onRowClick?`, `loading?`
   - Column definition: { key, label, render?, sortable?, align? }
   - Built on shadcn Table
   - Sorting: clickable headers, asc/desc toggle
   - Loading state: Skeleton rows
   - Empty state: "Khong co du lieu" message
   - Amount columns: right-aligned, mono font

### 6. Pagination Component (0.5h)
1. `components/shared/pagination.tsx`
   - Props: { page, limit, total, onPageChange }
   - Display: "Hien thi X-Y trong Z ban ghi"
   - Prev/Next buttons, page number display
   - Limit selector: 10, 25, 50, 100

### 7. Shared UI Components (0.5h)
1. `components/shared/status-badge.tsx`
   - Props: { status: OrderStatus }
   - Color mapping per design-guidelines.md semantic tokens
   - Vietnamese labels: Chua TT, Thanh toan 1 phan, Da thanh toan, Hoan 1 phan, Da hoan tien
2. `components/shared/currency-amount.tsx`
   - Props: { amount: string, currencyCode: string, currencySymbol: string }
   - Format: `$1,250.00` (USD), `Y1,250.00` (RMB), `1.250.000 D` (VND)
   - IBM Plex Mono, tabular-nums, right-aligned
   - Negative amounts in red
3. `components/shared/filter-bar.tsx`
   - Props: { filters: FilterConfig[], onFilterChange }
   - Renders select dropdowns + date range + search input in a row
   - Responsive: stacks on mobile
4. `components/shared/confirmation-dialog.tsx`
   - Props: { open, onConfirm, onCancel, title, description, variant: 'danger' | 'default' }
   - Built on shadcn Dialog
   - Used for delete confirmations

## Todo Checklist

- [x] Install all shadcn/ui primitives
- [x] app/(dashboard)/layout.tsx with auth check
- [x] components/layout/sidebar.tsx with nav groups + RBAC
- [x] components/layout/header.tsx with BU selector + user info
- [x] components/shared/data-table.tsx (generic, sortable)
- [x] components/shared/pagination.tsx
- [x] components/shared/status-badge.tsx
- [x] components/shared/currency-amount.tsx
- [x] components/shared/filter-bar.tsx
- [x] components/shared/confirmation-dialog.tsx
- [x] Responsive layout: sidebar collapse on mobile/tablet
- [x] Verify: all components render without errors

## Success Criteria
1. Dashboard layout renders with sidebar + header + content area
2. Sidebar shows correct nav groups based on user roles
3. Mobile: sidebar collapses to hamburger menu
4. Data table renders with sorting, loading, and empty states
5. Currency amounts display with correct formatting per currency
6. Status badges show correct colors and Vietnamese labels
7. BU selector switches business unit context
8. All shared components are reusable (no hardcoded data)

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| shadcn/ui version mismatch with Next.js | Low | Medium | Pin shadcn version, test after install |
| IBM Plex fonts not loading (FOIT) | Low | Low | Use font-display: swap, fallback to system-ui |
| Sidebar RBAC logic complex | Medium | Low | Simple role-to-navItems mapping, hide if no access |
| BU context lost on navigation | Medium | Medium | Store in cookie or URL search params, not just React state |

## Security Considerations
- Dashboard layout checks auth server-side before rendering
- Sidebar hides admin nav items for non-ADMIN roles (defense in depth, APIs also enforce)
- No sensitive data in client components -- session only contains id, name, roles
- BU selector value validated server-side on every API call
