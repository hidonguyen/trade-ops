# Phase 8: Reports + Dashboard + Admin UI

## Context Links
- [Design Guidelines](../../docs/design-guidelines.md) -- KPI cards, charts, data tables
- [Wireframe: Dashboard](../../docs/wireframes/01-dashboard.html)
- [Wireframe: Reports](../../docs/wireframes/06-reports.html)
- [Wireframe: Settings/Users](../../docs/wireframes/04-settings-users.html)
- Phase 4 (APIs consumed by this phase)
- Phase 5 (shared components used)

## Overview
- **Priority:** P2
- **Status:** Complete
- **Effort:** 4h
- **Blocked by:** Phase 4 (APIs), Phase 5 (shared components)
- **Blocks:** None
- **Parallel with:** Phases 6, 7
- **Description:** Build dashboard home page with KPI cards and charts, reports page with summary tables and export, user management pages (ADMIN), and audit log viewer.

## Key Insights
- Dashboard is the default landing page after login
- KPI cards: total receivable, total payable, deposit balance, recent transactions
- Charts: bar chart (receipts vs payments by month), pie chart (currency distribution) -- recharts
- Reports page: tabbed view (Sales Summary, Purchase Summary, Receivable Aging, Payable Aging)
- User management: ADMIN only, shows user list with role badges
- Audit log: searchable table, ADMIN only
- All report tables support Excel export via export button

## File Ownership (Exclusive)

```
app/(dashboard)/page.tsx
app/(dashboard)/reports/page.tsx
app/(dashboard)/settings/users/page.tsx
app/(dashboard)/settings/users/[id]/page.tsx
app/(dashboard)/settings/users/new/page.tsx
app/(dashboard)/settings/audit-logs/page.tsx
components/kpi-card.tsx
components/dashboard-charts.tsx
components/user-form.tsx
```

## Implementation Steps

### 1. KPI Card Component (0.5h)
1. `components/kpi-card.tsx`
   - Props: { title, value, subtitle?, icon?, accentColor? }
   - Card with colored top border accent (4px)
   - Value: large mono font, formatted with separators
   - Uses shadcn Card

### 2. Dashboard Charts Component (0.5h)
1. `components/dashboard-charts.tsx`
   - Two charts side by side (lg:grid-cols-2):
     a. Bar chart: monthly receipts (blue) vs payments (amber) -- recharts BarChart
     b. Pie chart: currency distribution (donut) -- recharts PieChart
   - Props: { barData, pieData }
   - Colors per design-guidelines: #1E3A8A (thu), #F59E0B (chi), pie: #1E3A8A/#0284C7/#7C3AED

### 3. Dashboard Home Page (0.5h)
1. `app/(dashboard)/page.tsx`
   - Fetch KPI data from /api/reports/dashboard
   - 4 KPI cards in grid (grid-cols-1 sm:grid-cols-2 xl:grid-cols-4)
   - Charts section below KPIs
   - Recent transactions table (last 10)
   - FilterBar: businessUnitId selector at top

### 4. Reports Page (1h)
1. `app/(dashboard)/reports/page.tsx`
   - FilterBar: businessUnitId, dateFrom, dateTo
   - Tabs: Sales Summary | Purchase Summary | Receivable Aging | Payable Aging
   - Each tab fetches from /api/reports/summary with type param
   - DataTable for each summary type:
     - Sales: party, total orders, total amount, paid, remaining (by currency)
     - Purchase: party, total orders, total amount, paid, remaining
     - Receivable aging: party, current, 30d, 60d, 90d+ buckets
     - Payable aging: party, current, 30d, 60d, 90d+ buckets
   - Export button per tab: calls API with ?format=xlsx

### 5. User Management Pages (1h)
1. `components/user-form.tsx`
   - Props: { initialData?, onSubmit, mode }
   - Fields: name, email, password (create only), isActive toggle, roles (multi-select checkboxes)
   - Role options: ADMIN, ACCOUNTANT_SALE, ACCOUNTANT_PURCHASE, ACCOUNTANT_CASHFLOW, VIEWER
2. `app/(dashboard)/settings/users/page.tsx`
   - ADMIN-only check
   - DataTable: name, email, roles (badge list), active status, actions
   - "Them nguoi dung" button -> /settings/users/new
3. `app/(dashboard)/settings/users/new/page.tsx`
   - Renders UserForm, POST to /api/users
4. `app/(dashboard)/settings/users/[id]/page.tsx`
   - Fetch user, render UserForm in edit mode
   - PATCH to /api/users/[id]
   - Deactivate button with ConfirmationDialog

### 6. Audit Log Viewer (0.5h)
1. `app/(dashboard)/settings/audit-logs/page.tsx`
   - ADMIN-only check
   - FilterBar: userId (select), model (select), action (CREATE/UPDATE/DELETE), dateFrom, dateTo
   - DataTable: timestamp, user name, action, model, record ID
   - Row click: expand to show changes JSON (before/after)
   - Pagination, sort by timestamp desc

## Todo Checklist

- [x] components/kpi-card.tsx
- [x] components/dashboard-charts.tsx (bar + pie charts)
- [x] Dashboard home page with KPIs + charts + recent txns
- [x] Reports page with 4 tabs + filters + export
- [x] components/user-form.tsx (create/edit with role checkboxes)
- [x] User list page (ADMIN only)
- [x] User create page
- [x] User edit/detail page
- [x] Audit log viewer page (ADMIN only, filters + expandable rows)
- [x] Excel export buttons on reports
- [x] RBAC: ADMIN check on user mgmt + audit log pages

## Success Criteria
1. Dashboard loads KPI cards with correct aggregated values
2. Charts render with correct colors and data
3. Reports page: each tab shows correct summary data
4. Excel export downloads valid .xlsx file
5. User creation: form validates, creates user with roles, redirects to list
6. User edit: role changes saved correctly
7. User deactivation: confirmation dialog, soft delete
8. Audit log: filterable, shows changes JSON on expand
9. Non-ADMIN users cannot access user mgmt or audit log pages

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| recharts bundle size | Low | Low | Dynamic import charts component |
| Dashboard KPI slow load | Medium | Medium | Show Skeleton loading states; consider caching API |
| Audit log changes JSON hard to read | Medium | Low | Format as diff view or key-value table |
| Reports page too many tabs (>200 LOC) | Medium | Medium | Each tab content as separate sub-component |

## Security Considerations
- User management pages: ADMIN-only server and client-side checks
- Password field: only shown on create, never pre-filled on edit
- Audit log: read-only, no delete/edit capability
- User list: passwordHash never included in API response
- Excel export: server-generated, no user-controlled template injection
