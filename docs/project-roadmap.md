# Project Roadmap – Trade Ops
## Implementation Phases & Timeline

**Status:** Implementation Phase (Phases 1-8 Complete)
**Last Updated:** 2026-04-02
**Version:** 1.0

---

## Overview

Trade Ops development is structured into 13 sequential phases. Phases 1-8 complete the full implementation of core APIs and UI. All phases are being tracked actively; status updates reflect real progress.

**Milestone Structure:**
- **Phases 1–4:** Foundation (environment, schema, auth, helpers)
- **Phases 5–6:** Configuration & Data (settings, parties, deposits)
- **Phases 7–9:** Core Business Logic (orders, payments, transactions)
- **Phases 10–12:** Reporting & Admin (reports, dashboard, users)
- **Phase 13:** Quality Assurance (testing, review, performance)

---

## Phase Overview & Status

| Phase | Name | Status | Owner | Deps |
|-------|------|--------|-------|------|
| 1 | Environment & Setup | Complete | - | - |
| 2 | Database Schema & Migrations | Complete | - | Phase 1 |
| 3 | Authentication & Authorization | Complete | - | Phase 2 |
| 4 | Core API Helpers & Audit | Complete | - | Phase 3 |
| 5 | Settings APIs (Config) | Complete | - | Phase 4 |
| 6 | Parties & Deposits | Complete | - | Phase 5 |
| 7 | Sales Orders & Payments | Complete | - | Phase 6 |
| 8 | Purchase Orders & Payables | Complete | - | Phase 6 |
| 9 | Standalone Transactions | Planned | - | Phase 6 |
| 10 | Cashflow Reports & Excel Export | Planned | - | Phase 9 |
| 11 | Summary Reports & Dashboard | Planned | - | Phase 10 |
| 12 | User Management & Audit Logs | Planned | - | Phase 4 |
| 13 | Integration & Performance | Planned | - | Phases 1–12 |

---

## Phase Descriptions

### Phase 1: Environment & Setup
**Status:** Complete  
**Duration:** 2–3 days  
**Objective:** Initialize Next.js project, install dependencies, configure Docker local dev.

**Scope:**
- Create Next.js 14 project with TypeScript
- Install core packages: prisma, next-auth, tailwindcss, zod, decimal.js, exceljs, recharts
- Set up tailwindcss + shadcn/ui
- Create `docker-compose.yml` for PostgreSQL + pgAdmin
- Configure `.env.example` with all required variables
- Set up TypeScript strict mode

**Deliverables:**
- Working Next.js dev environment
- Docker containers running locally
- `package.json` with all dependencies locked

**Success Criteria:**
- `npm run dev` starts without errors
- `docker-compose up -d` brings up PostgreSQL + pgAdmin
- TypeScript compilation passes

---

### Phase 2: Database Schema & Migrations
**Status:** Complete  
**Duration:** 3–4 days  
**Objective:** Define Prisma schema, create migrations, seed base data.

**Scope:**
- Write complete `schema.prisma` with all models
- Define enums: OrderStatus, PartyType, TransactionType, PaymentMethod, PaymentType, AuditAction
- Configure all relations (1:M, M:N) and constraints
- Add indexes on common query paths
- Create initial migration
- Write `seed.ts` script

**Database Entities:**
- User, UserRoleAssignment
- AuditLog
- BusinessUnit, Currency, ExpenseType
- Party, Deposit, DepositUsage
- Order, Transaction

**Deliverables:**
- `schema.prisma` (complete)
- `migrations/` directory with initial schema
- `seed.ts` (admin user + base data)
- Database running with schema applied

**Success Criteria:**
- `npx prisma migrate dev` creates database successfully
- `npx prisma db seed` populates base data
- `npx prisma studio` opens without errors

---

### Phase 3: Authentication & Authorization
**Status:** Complete  
**Duration:** 2–3 days  
**Objective:** Implement NextAuth.js v5, RBAC middleware, login page.

**Scope:**
- Configure NextAuth.js v5: credentials provider, JWT session
- Implement password hashing (bcrypt via NextAuth)
- Create login page (`/app/(auth)/login/page.tsx`)
- Write `lib/auth.ts` config + exports
- Create `middleware.ts` to protect dashboard routes
- Implement permission matrix in `lib/rbac.ts`
- Write `lib/api-helpers.ts`: `withAuth()`, `checkAccess()`, `apiResponse()`

**RBAC Roles:**
- ADMIN (full access everywhere)
- ACCOUNTANT_SALE (sales + customers + receipts; read-only purchases)
- ACCOUNTANT_PURCHASE (purchases + suppliers + payments; read-only sales)
- ACCOUNTANT_CASHFLOW (receipts/payments/cashflow; read-only sales/purchases)
- VIEWER (read-only all)

**Deliverables:**
- Functional login page
- Protected dashboard routes
- RBAC permission checks
- JWT session handling

**Success Criteria:**
- Login works with test credentials
- Non-authenticated users redirected to `/login`
- Role-based access enforced (403 on permission deny)

---

### Phase 4: Core API Helpers & Audit
**Status:** Complete  
**Duration:** 2 days  
**Objective:** Implement shared API utilities and audit logging.

**Scope:**
- `lib/prisma.ts` – PrismaClient singleton
- `lib/api-helpers.ts` – Response formatting, auth, access checks
- `lib/audit-logger.ts` – Create AuditLog entries
- `lib/decimal-utils.ts` – Decimal.js helpers
- `lib/validation-schemas.ts` – Base zod schemas
- Create base Route Handler pattern template

**Deliverables:**
- Reusable API response format
- Audit logging infrastructure
- Standard error handling
- Decimal validation helper

**Success Criteria:**
- All Route Handlers use consistent response format
- Every CREATE/UPDATE/DELETE creates AuditLog entry
- No implicit `any` types

---

### Phase 5: Settings APIs (Configuration)
**Status:** Complete  
**Duration:** 2–3 days  
**Objective:** Implement business configuration CRUD endpoints.

**Scope:**
- **BusinessUnit API:**
  - GET `/api/business-units` (list all, admin only)
  - POST `/api/business-units` (create, admin only)
  - PATCH `/api/business-units/[id]` (update, admin only)

- **Currency API:**
  - GET `/api/currencies` (list, all users)
  - POST `/api/currencies` (create, admin only)
  - PATCH `/api/currencies/[id]` (update, admin only)

- **ExpenseType API:**
  - GET `/api/expense-types` (list, all users)
  - POST `/api/expense-types` (create, admin only)
  - PATCH `/api/expense-types/[id]` (update, admin only)

- **UI Pages:**
  - `/app/(dashboard)/settings/business-units`
  - `/app/(dashboard)/settings/currencies`
  - `/app/(dashboard)/settings/expense-types`

**Deliverables:**
- All settings endpoints functional
- Admin-only permission checks
- CRUD pages with forms

**Success Criteria:**
- All endpoints respond with correct status codes
- Permissions enforced (non-admins get 403)

---

### Phase 6: Parties & Deposits
**Status:** Complete  
**Duration:** 3–4 days  
**Objective:** Implement customer/supplier management and deposit functionality.

**Scope:**
- **Party API:**
  - GET `/api/parties` (list customers/suppliers)
  - POST `/api/parties` (create)
  - GET `/api/parties/[id]` (detail)
  - PATCH `/api/parties/[id]` (edit)
  - DELETE `/api/parties/[id]` (soft delete)

- **Deposit API:**
  - GET `/api/deposits` (list, with balance)
  - POST `/api/parties/[id]/deposits` (create deposit for party)
  - GET `/api/deposits/[id]` (detail + usage history)
  - PATCH `/api/deposits/[id]` (edit amount)
  - DELETE `/api/deposits/[id]`

- **Components:**
  - `PartyForm` (create/edit customer/supplier)
  - `DepositForm` (create/edit deposit)
  - `PartyList` (with search, filter by type)

- **Business Logic:**
  - `lib/deposit-service.ts` – Deposit deduction (used in later phases)

**Deliverables:**
- Full party CRUD with soft-delete
- Deposit lifecycle (create, track balance, edit, delete)
- Party list page with filters

**Success Criteria:**
- Create party, verify in list
- Add deposit to party, verify balance
- Edit party, changes persist
- Delete (soft) party, verify in archived list

---

### Phase 7: Sales Orders & Payments
**Status:** Complete  
**Duration:** 4–5 days  
**Objective:** Implement sales order creation, payment recording, receivable management.

**Scope:**
- **Order API (SALE type):**
  - GET `/api/orders?type=SALE` (list sales orders)
  - POST `/api/orders` (create sale order)
  - GET `/api/orders/[id]` (detail with transactions)
  - PATCH `/api/orders/[id]` (edit order)
  - DELETE `/api/orders/[id]` (soft delete)

- **Transaction API (SALE_PAYMENT):**
  - POST `/api/orders/[id]/transactions` (create sale payment)
  - GET `/api/orders/[id]/transactions` (list txns for order)
  - PATCH `/api/orders/[id]/transactions/[txId]` (edit payment)
  - DELETE `/api/orders/[id]/transactions/[txId]` (delete payment)

- **Business Logic:**
  - Auto-recalculate order status after transaction add/edit/delete
  - Support multi-currency payments (amountOriginal + amountVnd)
  - Deposit deduction: if paymentMethod === 'DEPOSIT', deduct from customer deposit
  - Status transitions: UNPAID → PARTIAL_PAID → PAID

- **Components:**
  - `OrderForm` (create/edit sale order)
  - `TransactionForm` (create/edit payment)
  - `OrderStatusBadge`
  - Sales orders list page with filters

**Key Patterns:**
- `recalculateOrderStatus()` called after every transaction change
- `deductDeposit()` called atomically with transaction creation
- All in `prisma.$transaction()` block

**Deliverables:**
- Full sales order lifecycle
- Payment recording with deposit deduction
- Status auto-calculation
- Sales orders page + detail pages

**Success Criteria:**
- Create sale order, verify status = UNPAID
- Record partial payment, status = PARTIAL_PAID
- Record full payment, status = PAID
- Refund (negative payment), status = PARTIAL_REFUNDED

---

### Phase 8: Purchase Orders & Payables
**Status:** Complete  
**Duration:** 4–5 days  
**Objective:** Mirror of Phase 7 for purchases (supplier orders, payment disbursements).

**Scope:**
- **Order API (PURCHASE type):**
  - Similar endpoints to Phase 7, but for PURCHASE orders
  - GET `/api/orders?type=PURCHASE`
  - POST/GET/PATCH/DELETE `/api/orders/[id]`

- **Transaction API (PURCHASE_PAYMENT):**
  - Similar endpoints, but type = PURCHASE_PAYMENT
  - Payment disbursement tracking

- **Business Logic:**
  - Same auto-status-calc and deposit handling as Phase 7
  - Status: UNPAID → PARTIAL_PAID → PAID

- **Components:**
  - Reuse OrderForm, TransactionForm (generic, type-aware)
  - Purchase orders page

**Deliverables:**
- Full purchase order lifecycle
- Payment disbursement tracking
- Status auto-calculation
- Purchase orders page + detail pages

**Success Criteria:**
- Create purchase order
- Record payments to supplier
- Verify status transitions

---

### Phase 9: Standalone Transactions
**Status:** Planned  
**Duration:** 2–3 days  
**Objective:** Implement RECEIPT and PAYMENT transactions (not linked to orders).

**Scope:**
- **Transaction API (standalone):**
  - GET `/api/transactions` (RECEIPT + PAYMENT only)
  - POST `/api/transactions` (create receipt or payment)
  - GET `/api/transactions/[id]` (detail)
  - PATCH `/api/transactions/[id]` (edit)
  - DELETE `/api/transactions/[id]`

- **Business Logic:**
  - Transactions linked to businessUnitId (not orderId)
  - Support deposit deduction (paymentMethod === 'DEPOSIT')
  - Multi-currency support

- **Components:**
  - Simplified `TransactionForm` (no order context)
  - Transactions page with filters (receipt vs payment)

**Deliverables:**
- Standalone receipt/payment recording
- Transactions page
- Deposit deduction support

**Success Criteria:**
- Create receipt, verify in transactions list
- Create payment, verify deposit deducted if applicable

---

### Phase 10: Cashflow Reports & Excel Export
**Status:** Planned  
**Duration:** 3–4 days  
**Objective:** Implement cashflow reporting and Excel export functionality.

**Scope:**
- **Cashflow Report API:**
  - GET `/api/cashflow-report?businessUnitId=&dateFrom=&dateTo=&currency=` (summary)
  - Returns: total receipts, total payments, net flow, grouped by currency
  - Combines RECEIPT + PAYMENT + SALE_PAYMENT + PURCHASE_PAYMENT

- **Business Logic:**
  - `lib/cashflow-query.ts` – Query builder
  - Single Prisma query joining transactions (direct + via order.businessUnitId)
  - Group by currency, sum by transaction type

- **Excel Export:**
  - POST `/api/reports/cashflow/export` (download .xlsx)
  - `lib/excel-export-service.ts` – Format, style, export
  - Use exceljs for formatting, formulas, charts

- **Components:**
  - Cashflow page with date picker, currency filter
  - `CashflowChart` (recharts line chart: receipts vs payments over time)
  - `ExportButton` (trigger Excel download)

**Deliverables:**
- Cashflow report query
- Cashflow page with chart
- Excel export functionality

**Success Criteria:**
- Cashflow report shows correct totals
- Chart renders correctly
- Excel file downloads with proper formatting

---

### Phase 11: Summary Reports & Dashboard
**Status:** Planned  
**Duration:** 4–5 days  
**Objective:** Implement financial dashboards, summary reports, aging analysis.

**Scope:**
- **Reports API:**
  - GET `/api/reports/dashboard` (KPI cards)
  - GET `/api/reports/summary?type=sales|purchase|receivable|payable` (detailed summaries)
  - GET `/api/reports/summary/[type]/export` (Excel export per report)

- **Dashboard KPIs:**
  - Total receivable (unpaid + partial_paid orders)
  - Total payable (unpaid + partial_paid orders)
  - Cash balance (sum of deposits)
  - Recent transactions (last 10)

- **Reports:**
  - **Sales Summary:** Total revenue by currency, by customer, by date range
  - **Purchase Summary:** Total purchases by currency, by supplier, by date range
  - **Receivable Aging:** Customers bucketed by days overdue (current, 30, 60, 90+)
  - **Payable Aging:** Suppliers bucketed by days overdue

- **Business Logic:**
  - `lib/report-generator.ts` – All report queries
  - Use Decimal for all aggregations

- **Components:**
  - Dashboard home page: KPI cards + recent transactions
  - Summary reports page with filters (date range, business unit)
  - `DashboardKpiCards` (display cards)
  - `AgingTable` (receivable/payable aging)
  - `ExportButton` (per-report export)

**Deliverables:**
- Dashboard page with KPI cards
- Summary reports page
- Receivable/Payable aging analysis
- Excel export per report

**Success Criteria:**
- Dashboard loads in <500ms
- All KPIs calculate correctly
- Aging analysis accurate
- Excel exports with proper formatting

---

### Phase 12: User Management & Audit Logs
**Status:** Planned  
**Duration:** 2–3 days  
**Objective:** Admin interface for user lifecycle and compliance audit.

**Scope:**
- **Users API:**
  - GET `/api/users` (list all users, admin only)
  - POST `/api/users` (create user, admin only)
  - PATCH `/api/users/[id]` (assign/revoke roles, admin only)
  - DELETE `/api/users/[id]` (deactivate, admin only)

- **Audit Logs API:**
  - GET `/api/audit-logs?model=&action=&userId=&dateFrom=&dateTo=` (search)
  - No write ops (read-only)
  - Searchable by model, action, user, date range

- **Components:**
  - Users management page (list, create, role assignment)
  - Audit logs page (search, view changes)

**Deliverables:**
- User management interface
- Audit log viewer with search
- Role assignment UI

**Success Criteria:**
- Create user, verify in list
- Assign role, verify in audit log
- Search audit logs by model/action
- View full transaction history per record

---

### Phase 13: Integration & Performance
**Status:** Planned  
**Duration:** 5–7 days  
**Objective:** End-to-end testing, performance optimization, final review.

**Scope:**
- **Testing:**
  - Integration tests for all major workflows
  - RBAC permission enforcement tests
  - Order status calculation edge cases
  - Deposit deduction atomicity
  - Excel export validation

- **Performance:**
  - Database query optimization (verify indexes used)
  - API response time benchmarks (target <500ms p95)
  - Large dataset stress test (1000+ transactions)
  - Pagination load testing

- **Documentation:**
  - Update `README.md` with setup instructions
  - Finalize all doc files
  - Create deployment guide
  - Write admin/operator runbooks

- **Security Review:**
  - RBAC exhaustive check (all roles, all modules)
  - SQL injection testing
  - XSS/CSRF prevention
  - Secrets management (.env validation)

- **Code Quality:**
  - TypeScript strict mode check
  - No console.logs in production code
  - Consistent code style (prettier)
  - File size review (all <200 LOC)

**Deliverables:**
- Test suite with 80%+ coverage
- Performance benchmarks
- Deployment guide
- Final documentation
- Security audit report

**Success Criteria:**
- All tests passing
- p95 response time <500ms
- All permission denials tested
- Zero console errors in browser
- Documentation complete and reviewed

---

## Milestone Summary

| Milestone | Phases | Target Date | Status |
|-----------|--------|-------------|--------|
| **Foundation Ready** | 1–4 | - | Planned |
| **Data Layer Ready** | 2, 5–6 | - | Planned |
| **Core Operations** | 7–9 | - | Planned |
| **Reporting Layer** | 10–11 | - | Planned |
| **Admin Ready** | 12 | - | Planned |
| **Launch Ready** | 13 | - | Planned |

---

## Dependencies & Blockers

### Phase Dependencies
```
1 (Setup)
├── 2 (Schema)
    ├── 3 (Auth)
    │   └── 4 (Helpers)
    │       ├── 5 (Settings)
    │       │   └── 6 (Parties)
    │       │       ├── 7 (Sales)
    │       │       ├── 8 (Purchase)
    │       │       └── 9 (Standalone)
    │       │           ├── 10 (Cashflow)
    │       │           │   └── 11 (Dashboard)
    │       │           └── 12 (Users)
    └── 12 (Users)
        └── 13 (Testing)
```

### No Parallel Execution
All phases are sequential. Phase N+1 depends on Phase N completion.

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Decimal.js errors | Critical | Strict code review, test all arithmetic |
| Deposit deduction race condition | Critical | Use Prisma $transaction for atomicity |
| Order status calc errors | High | Unit tests for all status transitions |
| RBAC bypass | High | Permission matrix test matrix |
| Excel memory leak (large exports) | Medium | Stream output, test with 10k+ rows |
| Query performance | Medium | Index all foreign keys, test with 100k rows |

---

## Success Criteria (Overall)

- [ ] All 13 phases complete
- [ ] 100% RBAC enforcement (no permission bypass)
- [ ] 100% audit trail (all writes logged)
- [ ] Zero money rounding errors (Decimal.js throughout)
- [ ] <500ms p95 API response time
- [ ] 80%+ test coverage
- [ ] All documentation complete and accurate
- [ ] Deployment guide tested and verified

---

## Related Documentation

- `/docs/project-overview-pdr.md` – Requirements by phase
- `/docs/system-architecture.md` – Technical foundation
- `/docs/code-standards.md` – Implementation guidelines
- `/docs/deployment-guide.md` – Deployment procedures

