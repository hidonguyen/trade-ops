# Trade Ops – Import/Export Financial Management Software
## Project Overview & Product Development Requirements (PDR)

**Status:** Project Planning Phase
**Last Updated:** 2026-04-02
**Version:** 1.0

---

## Executive Summary

Trade Ops is a comprehensive fullstack web application designed to manage financial operations for import/export businesses. It provides integrated management across sales, purchases, cash flow, and reporting with multi-currency support (VND/USD/RMB), role-based access control (RBAC), and complete audit trail capabilities.

The system serves businesses with multiple operational units (TK/NT) and provides real-time visibility into financial position and transaction history.

---

## Project Goals & Objectives

### Primary Goals
1. **Centralized Financial Management** – Single source of truth for all import/export financial operations
2. **Multi-Unit Scalability** – Support multiple business units with isolated data
3. **Real-time Reporting** – Instant dashboards, cashflow insights, and financial summaries
4. **Compliance & Transparency** – Complete audit trail, role-based access, and data integrity
5. **Operational Efficiency** – Reduce manual data entry, automate status calculations, enable bulk operations

### Key Success Metrics
- Support 1000+ transactions/month per business unit
- Multi-currency transactions without computational errors (Decimal precision)
- 99% uptime on core transaction operations
- Audit trail captures 100% of write operations
- Sub-second API response times for standard queries

---

## User Roles & Permissions (RBAC)

Five role-based personas with hierarchical permission model. Users may hold multiple roles; permissions union (FULL > GET_ONLY > DENY).

| Role | Sales | Purchases | Cashflow | Reports | Users/Audit |
|------|-------|-----------|----------|---------|-------------|
| **ADMIN** | FULL | FULL | FULL | FULL | FULL |
| **ACCOUNTANT_SALE** | FULL | GET_ONLY | DENY | FULL | DENY |
| **ACCOUNTANT_PURCHASE** | GET_ONLY | FULL | DENY | FULL | DENY |
| **ACCOUNTANT_CASHFLOW** | GET_ONLY | GET_ONLY | FULL | FULL | DENY |
| **VIEWER** | GET_ONLY | GET_ONLY | GET_ONLY | GET_ONLY | DENY |

Permission levels:
- **FULL**: Create, Read, Update, Delete operations
- **GET_ONLY**: Read-only access
- **DENY**: No access (returns 403)

---

## System Modules

### 1. Sales & Receivables (Bán hàng & Phải thu)
**Owner:** ACCOUNTANT_SALE role

Manage customer orders, payment receipts, refunds, and outstanding receivables.

**Core Entities:**
- Customers (Party type: CUSTOMER)
- Sales Orders (Order type: SALE, tracks customer amounts owed)
- Sale Payments (Transaction type: SALE_PAYMENT, received from customer)
- Customer Deposits (Deposit model, fund pool for prepayments)

**Key Workflows:**
- Create sale order → system auto-calculates order status based on payments
- Record payment from customer → auto-deduct from deposit if prepaid
- Issue refund → decrement receivable
- Track customer aging (unpaid vs overdue orders)

---

### 2. Purchases & Payables (Mua hàng & Phải trả)
**Owner:** ACCOUNTANT_PURCHASE role

Manage supplier orders, payment disbursements, and outstanding payables.

**Core Entities:**
- Suppliers (Party type: SUPPLIER)
- Purchase Orders (Order type: PURCHASE, tracks supplier amounts owed)
- Purchase Payments (Transaction type: PURCHASE_PAYMENT, paid to supplier)
- Supplier Deposits (Deposit model, fund pool for advances)

**Key Workflows:**
- Create purchase order → system auto-calculates order status
- Record payment to supplier → auto-deduct from deposit if advance
- Issue refund/credit → decrement payable
- Track supplier aging (unpaid vs overdue obligations)

---

### 3. Cash Flow (Thu Chi)
**Owner:** ACCOUNTANT_CASHFLOW role

Unified view of all money in/out across business operations.

**Core Entities:**
- Receipts (Transaction type: RECEIPT, standalone money-in)
- Payments (Transaction type: PAYMENT, standalone money-out)
- Deposits (fund pools tied to business unit)

**Key Workflows:**
- Record bank receipts from customers or other sources
- Record bank payments for suppliers or expenses
- Link transactions to deposits for fund tracking
- Generate cashflow report (reconcile with bank statements)

---

### 4. Reports & Dashboard
**Owner:** ADMIN, all ACCOUNTANT_* roles

Real-time financial dashboards and exportable reports.

**Report Types:**
- **Dashboard** – KPI cards: total receivable, payable, cash balance, recent transactions
- **Cashflow Report** – Period-based summary: total receipts/payments by currency, deposit usage
- **Summary Reports** – Sales summary, purchase summary, receivable aging, payable aging
- **Excel Export** – All reports exportable to .xlsx format for offline analysis

---

## Functional Requirements by Module

### Sales & Receivables
1. Create customer with multi-currency support
2. Create sale orders linked to customer
3. Record sale payments with amountOriginal, currency, exchangeRate
4. Auto-calculate order status: UNPAID → PARTIAL_PAID → PAID
5. Apply customer prepaid deposits to payments
6. Issue refunds (PARTIAL_REFUNDED, REFUNDED states)
7. Customer list with aging summary (30/60/90 day buckets)

### Purchases & Payables
1. Create supplier with multi-currency support
2. Create purchase orders linked to supplier
3. Record purchase payments with multi-currency
4. Auto-calculate order status based on payment total
5. Apply supplier prepaid deposits to payments
6. Issue credits/refunds to suppliers
7. Supplier list with aging summary

### Cash Flow
1. Record standalone receipts (no order link)
2. Record standalone payments (no order link)
3. Link transactions to deposits
4. View deposit balance and remaining amount
5. Generate period cashflow report (receipts vs payments)
6. Filter by currency, business unit, date range
7. Export cashflow report to Excel

### Reports & Dashboard
1. Dashboard displays KPI cards (real-time)
2. Summary reports: totals by customer, supplier, currency
3. Receivable aging report
4. Payable aging report
5. Cashflow trend report
6. Excel export all reports
7. Filter by date range, business unit, currency

### Settings & Admin
1. Manage business units (TK, NT) – users can switch context
2. Manage currencies (VND, USD, RMB)
3. Manage expense types for categorization
4. User management (create, assign roles, deactivate)
5. Audit log viewer with filters
6. Role assignment and permission review

---

## Data Integrity Requirements

### Atomicity
- All multi-step operations (order creation + status calc) execute in Prisma $transaction
- Deposit deductions atomic: Transaction + Deposit.remainingOriginal decrement + DepositUsage record
- No partial writes on failure

### Money Handling
- All monetary values stored as Decimal(18, 4) in PostgreSQL
- Frontend computes amountVnd (amountOriginal × user-entered rate) and sends both
- Backend never computes exchange rates; only stores amountOriginal and receives amountVnd from client
- Decimal.js library for all arithmetic in Node.js code

### Order Status Recalculation
- Trigger: after every Transaction add/edit/delete
- Logic: sum all Transaction.amount for matching order, compare to Order.amountOriginal
  - 0% paid → UNPAID
  - 0% < paid < 100% → PARTIAL_PAID
  - 100% paid → PAID
  - Refunds decrease total paid, may move status backward

### Audit Trail
- AuditLog entry created for every CREATE, UPDATE, DELETE operation
- Captures: user, action (CREATE/UPDATE/DELETE), model, record ID, timestamp, changes (old/new values)
- Non-repudiation: admin can review full transaction history

---

## Non-Functional Requirements

| Requirement | Target |
|-------------|--------|
| Concurrent Users | 100+ per deployment |
| Transaction Throughput | 1000+ txn/month |
| API Response Time | <500ms p95 |
| Database Uptime | 99.5% |
| Data Retention | Indefinite (audit logs) |
| Audit Log Retention | 7 years (compliance) |
| Supported Currencies | VND, USD, RMB (extensible) |
| Business Units | 10+ per deployment |
| Decimal Precision | 4 digits (cents/smallest unit) |

---

## Technical Constraints

1. **UUID(7)** – All primary IDs use uuid(7) from Prisma 5.10+
2. **PostgreSQL 14+** – Decimal type, jsonb support, transactions
3. **Decimal.js** – Never use number or float for monetary values
4. **Next.js 14+ App Router** – Server components, Route Handlers
5. **TypeScript** – Strict mode, no `any` types
6. **Prisma 5.10+** – $transaction, JsonValue types
7. **NextAuth.js v5** – JWT sessions, credentials provider

---

## Implementation Phases

See `/docs/project-roadmap.md` for detailed 13-phase implementation plan with milestones and dependencies.

Phases:
1. Environment setup + docker-compose
2. Prisma schema + migrations + seed
3. NextAuth.js v5 + RBAC middleware
4. Core API helpers (prisma, audit, validation)
5. Settings APIs (BusinessUnit, Currency, ExpenseType)
6. Party management + Deposits
7. Sales orders + SALE_PAYMENT logic
8. Purchase orders + PURCHASE_PAYMENT logic
9. RECEIPT + PAYMENT standalone transactions
10. Cashflow report + Excel export
11. Summary reports + Dashboard UI
12. User management + Audit log viewer
13. Integration testing + performance review

---

## Dependencies & External Services

- **PostgreSQL** – Database (Docker or managed)
- **Node.js 18+** – Runtime
- **npm** – Package manager
- **Docker** – Local dev environment
- **NextAuth.js** – Authentication (no external OAuth required; credentials-only provider)

---

## Security & Compliance

- **Authentication** – JWT-based sessions via NextAuth.js
- **Authorization** – Role-based access control (5 roles, permission union)
- **Data Protection** – All passwords hashed (bcrypt via NextAuth)
- **Audit** – Non-repudiation: all writes logged with user, action, timestamp
- **HTTPS** – Enforced in production via deployment platform (Vercel, Railway, etc.)
- **CORS** – Configured for same-origin requests only

---

## Success Criteria

- All 13 implementation phases complete and tested
- 100% RBAC enforcement (no permission bypass)
- 100% audit trail coverage (no write operation unlogged)
- Zero monetary rounding errors (Decimal.js throughout)
- All order status calculations correct after any transaction change
- Performance: <500ms on standard queries
- Deployment instructions clear and repeatable

---

## Related Documentation

- `/docs/system-architecture.md` – Technical architecture, data model, API design
- `/docs/code-standards.md` – Coding conventions, patterns, review checklist
- `/docs/codebase-summary.md` – Directory structure and file organization
- `/docs/project-roadmap.md` – Phase-by-phase implementation timeline
- `/docs/deployment-guide.md` – Setup, configuration, deployment steps

