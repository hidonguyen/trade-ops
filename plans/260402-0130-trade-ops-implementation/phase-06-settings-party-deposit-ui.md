# Phase 6: Settings + Party + Deposit UI

## Context Links
- [Design Guidelines](../../docs/design-guidelines.md) -- form inputs, buttons, cards
- [Wireframe: Settings](../../docs/wireframes/04-settings-users.html)
- [Wireframe: Parties](../../docs/wireframes/05-parties.html)
- [Wireframe: Deposits](../../docs/wireframes/07-deposits.html)
- Phase 2 (APIs consumed by this phase)
- Phase 5 (shared components used)

## Overview
- **Priority:** P2
- **Status:** Complete
- **Effort:** 4h
- **Blocked by:** Phase 2 (APIs), Phase 5 (shared components)
- **Blocks:** None
- **Parallel with:** Phases 7, 8
- **Description:** Build UI pages for settings (business units, currencies, expense types), party management (list, detail, create, edit), and deposit management within party detail.

## Key Insights
- Settings pages are ADMIN-only -- show 403 message for non-admins
- Party list supports type filter (Customer/Supplier/Both) and search
- Party detail page shows: info card + deposit list + order history link
- Deposit list shows remaining balance with visual indicator
- All forms use controlled inputs with zod client-side validation
- Currency amounts in deposit list use CurrencyAmount component from Phase 5

## File Ownership (Exclusive)

```
app/(dashboard)/settings/page.tsx
app/(dashboard)/settings/business-units/page.tsx
app/(dashboard)/settings/currencies/page.tsx
app/(dashboard)/settings/expense-types/page.tsx
app/(dashboard)/parties/page.tsx
app/(dashboard)/parties/[id]/page.tsx
app/(dashboard)/parties/[id]/edit/page.tsx
app/(dashboard)/parties/new/page.tsx
components/party-form.tsx
components/deposit-form.tsx
components/deposit-list.tsx
```

## Implementation Steps

### 1. Settings Pages (1.5h)
1. `app/(dashboard)/settings/page.tsx`
   - Settings hub with links to sub-pages
   - Cards: Business Units, Currencies, Expense Types, Users (link to Phase 8)
2. `app/(dashboard)/settings/business-units/page.tsx`
   - DataTable listing BUs (code, name, active)
   - Inline create/edit dialog (small form: code + name)
   - Delete with ConfirmationDialog
   - ADMIN only -- check role, show forbidden message otherwise
3. `app/(dashboard)/settings/currencies/page.tsx`
   - DataTable: code, name, symbol, active
   - Inline create/edit dialog
4. `app/(dashboard)/settings/expense-types/page.tsx`
   - DataTable: name, active
   - Inline create/edit dialog

### 2. Party List Page (0.5h)
1. `app/(dashboard)/parties/page.tsx`
   - FilterBar: type (Customer/Supplier/All), search, businessUnit
   - DataTable with columns: name, type, phone, email, deposit balance
   - Pagination
   - "Them moi" (Add new) button -> /parties/new
   - Row click -> /parties/[id]

### 3. Party Form Component (0.5h)
1. `components/party-form.tsx`
   - Props: { initialData?, onSubmit, mode: 'create' | 'edit' }
   - Fields: name, type (select: CUSTOMER/SUPPLIER/BOTH), businessUnitId (select), address, phone, email, taxId
   - Client-side zod validation
   - Loading state on submit

### 4. Party Create/Edit Pages (0.5h)
1. `app/(dashboard)/parties/new/page.tsx`
   - Renders PartyForm in create mode
   - POST to /api/parties, redirect to detail on success
2. `app/(dashboard)/parties/[id]/edit/page.tsx`
   - Fetch party data, render PartyForm in edit mode
   - PATCH to /api/parties/[id], redirect to detail on success

### 5. Party Detail Page (0.5h)
1. `app/(dashboard)/parties/[id]/page.tsx`
   - Info card: name, type, contact details, taxId
   - Edit/Delete buttons (with RBAC check)
   - DepositList component below info card
   - Link to filtered orders list (/orders?partyId=xxx)

### 6. Deposit Components (0.5h)
1. `components/deposit-list.tsx`
   - Props: { partyId }
   - Fetches deposits from /api/parties/[id]/deposits
   - DataTable: date, currency+amount, remaining, usage count
   - CurrencyAmount component for amounts
   - "Them ky quy" (Add deposit) button opens DepositForm dialog
2. `components/deposit-form.tsx`
   - Dialog/modal form
   - Fields: currencyId (select), amountOriginal (Decimal input), businessUnitId
   - POST to /api/parties/[id]/deposits
   - On success: refresh deposit list

## Todo Checklist

- [x] Settings hub page with navigation cards
- [x] Business units settings page (list + inline CRUD)
- [x] Currencies settings page (list + inline CRUD)
- [x] Expense types settings page (list + inline CRUD)
- [x] Party list page with filters + pagination
- [x] Party form component (create/edit)
- [x] Party create page
- [x] Party edit page
- [x] Party detail page with info card
- [x] Deposit list component
- [x] Deposit form dialog
- [x] RBAC checks on all pages (ADMIN for settings)
- [x] Verify: all forms submit correctly to APIs

## Success Criteria
1. Settings pages: CRUD operations work for BU, Currency, ExpenseType
2. Non-ADMIN users see 403 on settings pages
3. Party list: filter by type, search by name, paginate
4. Party create/edit: form validates, saves, redirects
5. Party detail: shows deposits with correct remaining balances
6. Deposit creation: amount stored correctly, remainingOriginal = amountOriginal
7. All currency amounts use CurrencyAmount component formatting

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Settings inline edit UX complexity | Medium | Low | Use Dialog pattern instead of inline row editing |
| Party type filter + RBAC intersection | Medium | Medium | Filter API response server-side based on role |
| Deposit form decimal input validation | Medium | Low | Use Decimal.js validation on blur, show error |

## Security Considerations
- Settings pages check ADMIN role before rendering
- Party pages check appropriate dimension (CUSTOMER vs SUPPLIER) per user role
- Client-side RBAC is defense-in-depth; API enforces authoritative access control
- No sensitive data displayed beyond what API returns
