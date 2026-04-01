# Phase 4: Reports + Admin APIs

## Context Links
- [System Architecture](../../docs/system-architecture.md) -- cashflow query pattern, report endpoints
- [Code Standards](../../docs/code-standards.md) -- Excel export, query optimization
- [Wireframe: Dashboard](../../docs/wireframes/01-dashboard.html)
- [Wireframe: Reports](../../docs/wireframes/06-reports.html)
- [Wireframe: Settings/Users](../../docs/wireframes/04-settings-users.html)

## Overview
- **Priority:** P1
- **Status:** Planned
- **Effort:** 5h
- **Blocked by:** Phase 1
- **Blocks:** Phase 8
- **Parallel with:** Phases 2, 3, 5
- **Description:** Implement cashflow report, summary reports, dashboard KPI, Excel export, user management CRUD, and audit log viewer APIs.

## Key Insights
- Cashflow report combines 4 transaction types across order-linked and standalone
- Dashboard KPIs: total receivable, total payable, cash balance, recent transaction count
- Excel export uses exceljs, returns Buffer streamed as XLSX response
- User management is ADMIN-only
- Audit logs are read-only (GET), ADMIN-only, with filters
- Summary reports aggregate by currency -- use Prisma groupBy

## File Ownership (Exclusive)

```
app/api/cashflow-report/route.ts
app/api/reports/summary/route.ts
app/api/reports/dashboard/route.ts
app/api/users/route.ts
app/api/users/[id]/route.ts
app/api/audit-logs/route.ts
lib/excel-export-service.ts
```

## Implementation Steps

### 1. Cashflow Report API (1.5h)
1. `app/api/cashflow-report/route.ts`
   - GET: Query params: businessUnitId, dateFrom, dateTo, currencyId?
   - Fetch all transactions in period:
     - Standalone (RECEIPT/PAYMENT) by businessUnitId
     - Order-linked (SALE_PAYMENT/PURCHASE_PAYMENT) via order.businessUnitId
   - Group by currency, sum receipts (money-in) vs payments (money-out)
   - Money-in: RECEIPT + SALE_PAYMENT (paymentType=PAYMENT)
   - Money-out: PAYMENT + PURCHASE_PAYMENT (paymentType=PAYMENT)
   - Refunds reverse direction
   - Return: `{ currencies: [{ code, symbol, totalIn, totalOut, net }], transactions: [...] }`
   - Support Excel export via `?format=xlsx` query param
   - RBAC: CASHFLOW dimension

### 2. Excel Export Service (1h)
1. `lib/excel-export-service.ts`
   - `exportCashflowToExcel(data): Promise<Buffer>` -- formatted XLSX with headers, currency formatting
   - `exportOrdersToExcel(orders): Promise<Buffer>` -- order list with status, amounts
   - `exportTransactionsToExcel(transactions): Promise<Buffer>` -- transaction list
   - Use exceljs Workbook, set column widths, number formats for Decimal
   - Return Buffer for streaming in Response

### 3. Summary Reports API (0.5h)
1. `app/api/reports/summary/route.ts`
   - GET: Query params: businessUnitId, dateFrom, dateTo
   - Return aggregated data:
     - Total sales (by currency)
     - Total purchases (by currency)
     - Total receivable (unpaid/partial orders, SALE type)
     - Total payable (unpaid/partial orders, PURCHASE type)
   - RBAC: DASHBOARD dimension (all roles except where denied)

### 4. Dashboard KPI API (0.5h)
1. `app/api/reports/dashboard/route.ts`
   - GET: Query params: businessUnitId
   - Return KPI cards data:
     - Total receivable amount (sum of SALE orders where status != PAID, remaining amount)
     - Total payable amount (sum of PURCHASE orders where status != PAID, remaining amount)
     - Recent transactions count (last 30 days)
     - Total deposits balance (sum of remainingOriginal)
   - RBAC: DASHBOARD dimension (all roles)

### 5. User Management API (1h)
1. `app/api/users/route.ts`
   - GET: List users with roles (ADMIN only)
   - POST: Create user { email, name, password, roles[] }, bcrypt hash password
   - Validate unique email
2. `app/api/users/[id]/route.ts`
   - GET: User detail with roles
   - PATCH: Update user { name?, email?, password?, isActive?, roles[]? }
   - If roles changed: delete existing UserRoleAssignment, create new ones
   - DELETE: Soft delete (isActive=false)
   - All ADMIN-only, audit logged

### 6. Audit Log API (0.5h)
1. `app/api/audit-logs/route.ts`
   - GET: List with filters (?userId, ?model, ?action, ?dateFrom, ?dateTo, pagination)
   - Include user name in response
   - ADMIN-only, read-only
   - Sort by timestamp desc

## Todo Checklist

- [ ] Cashflow report GET with currency grouping
- [ ] Cashflow report Excel export (?format=xlsx)
- [ ] lib/excel-export-service.ts (cashflow, orders, transactions)
- [ ] Summary reports GET (sales, purchases, receivable, payable)
- [ ] Dashboard KPI GET (receivable, payable, deposits, recent txns)
- [ ] Users GET/POST (list, create with bcrypt)
- [ ] Users GET/PATCH/DELETE [id] (detail, update roles, deactivate)
- [ ] Audit logs GET with filters
- [ ] RBAC enforced: Users/AuditLogs = ADMIN only
- [ ] All user writes audit logged

## Success Criteria
1. Cashflow report correctly sums money-in vs money-out across transaction types
2. Excel export downloads valid .xlsx file with formatted columns
3. Dashboard KPIs return correct aggregated totals
4. User creation hashes password, assigns roles
5. Role update atomically replaces UserRoleAssignment records
6. Audit logs filterable by user, model, action, date range
7. Non-ADMIN users get 403 on user management and audit log endpoints

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Cashflow query performance (large datasets) | Medium | Medium | Add date range index on Transaction.transactionDate; limit date range to 1 year |
| Excel export memory for large datasets | Low | Medium | Stream workbook; set MAX_EXPORT_ROWS=100000 |
| Role update partial failure | Medium | High | Delete+create roles in prisma.$transaction |
| Dashboard KPI query N+1 | Medium | Medium | Use prisma aggregate functions, not fetch-then-sum |

## Security Considerations
- User passwords bcrypt hashed before storage (salt rounds: 12)
- ADMIN-only endpoints: double-check in checkAccess
- Audit log is append-only from API perspective (no UPDATE/DELETE endpoints)
- Password field never returned in user GET responses (select: exclude passwordHash)
- Excel files generated server-side, no user-controlled templates (XSS safe)
