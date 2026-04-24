# Codebase Summary – Trade Ops
## Directory Structure & File Organization

**Status:** Planning Phase
**Last Updated:** 2026-04-24
**Version:** 1.0

---

## Overview

Trade Ops uses a Next.js 14 App Router structure with clear separation of concerns:
- **`/app`** – Pages and API routes
- **`/components`** – React UI components
- **`/lib`** – Business logic, helpers, services
- **`/types`** – TypeScript type definitions
- **`/prisma`** – Database schema and migrations
- **`/public`** – Static assets

---

## Directory Structure

```
trade-ops/
├── app/                              # Next.js App Router
│   ├── api/                          # API Route Handlers (REST endpoints)
│   │   ├── auth/[...nextauth]/       # NextAuth.js callbacks & configuration
│   │   ├── business-units/           # BusinessUnit CRUD endpoints
│   │   ├── currencies/               # Currency CRUD endpoints
│   │   ├── expense-types/            # ExpenseType CRUD endpoints
│   │   ├── parties/                  # Party (Customer/Supplier) CRUD
│   │   │   └── [id]/                 # Dynamic route for single party detail
│   │   │       └── deposits/         # Create deposit for party
│   │   ├── deposits/                 # Deposit balance & management (GET/POST)
│   │   │   └── [id]/                 # Single deposit detail (PATCH/DELETE with guards)
│   │   ├── orders/                   # Order CRUD (Sales & Purchases)
│   │   │   └── [id]/                 # Dynamic order detail
│   │   │       ├── transactions/     # Linked transactions for order
│   │   │       │   └── [txId]/       # Create/edit/delete transaction
│   │   │       ├── status/           # Get current order status
│   │   │       └── report/           # Order summary (paid, refunded, due)
│   │   ├── transactions/             # Standalone receipts & payments
│   │   │   └── [id]/                 # Single transaction detail/edit
│   │   ├── cashflow-report/          # Cashflow summary report
│   │   ├── reports/                  # Reports & Dashboard
│   │   │   ├── summary/              # Sales/Purchase/Receivable summaries
│   │   │   │   └── [type]/           # Specific report type
│   │   │   └── dashboard/            # KPI dashboard data
│   │   ├── users/                    # User management CRUD
│   │   │   └── [id]/                 # Assign roles, deactivate
│   │   └── audit-logs/               # Audit log viewer (GET only)
│   ├── (auth)/                       # Auth layout group
│   │   └── login/                    # Login page
│   │       └── page.tsx
│   └── (dashboard)/                  # Protected dashboard layout group
│       ├── layout.tsx                # Shared dashboard layout
│       ├── page.tsx                  # Dashboard home (KPI cards)
│       ├── orders/                   # Orders page & list
│       │   ├── page.tsx              # Orders list
│       │   ├── [id]/                 # Order detail page
│       │   │   ├── page.tsx          # Order detail view
│       │   │   └── edit/
│       │   │       └── page.tsx      # Order edit form
│       │   └── new/
│       │       └── page.tsx          # Create order form
│       ├── parties/                  # Parties (Customers/Suppliers)
│       │   ├── page.tsx
│       │   ├── [id]/
│       │   │   ├── page.tsx
│       │   │   └── edit/
│       │   │       └── page.tsx
│       │   └── new/
│       │       └── page.tsx
│       ├── transactions/             # Transactions page
│       │   ├── page.tsx
│       │   └── new/
│       │       └── page.tsx          # New receipt/payment
│       ├── cashflow/                 # Cashflow report
│       │   └── page.tsx
│       ├── reports/                  # Summary reports
│       │   ├── page.tsx
│       │   └── [type]/
│       │       └── page.tsx          # Individual report
│       └── settings/                 # Admin settings
│           ├── page.tsx              # Settings home
│           ├── business-units/
│           ├── users/
│           ├── currencies/
│           └── audit-logs/
├── components/                       # React components
│   ├── ui/                           # shadcn/ui primitives
│   │   ├── button.tsx
│   │   ├── input.tsx
│   │   ├── select.tsx
│   │   ├── table.tsx
│   │   ├── dialog.tsx
│   │   └── ...
│   ├── layout/                       # Page layout components
│   │   ├── navbar.tsx                # Top navigation bar
│   │   ├── sidebar.tsx               # Dashboard sidebar
│   │   ├── breadcrumb.tsx            # Breadcrumb navigation
│   │   └── footer.tsx
│   ├── shared/                       # Shared business components
│   │   ├── party-form.tsx            # Customer/Supplier form
│   │   ├── order-form.tsx            # Create/edit order form
│   │   ├── transaction-form.tsx      # Create/edit transaction form
│   │   ├── deposit-form.tsx          # Create/edit deposit form
│   │   ├── order-status-badge.tsx    # Status display (PAID, UNPAID, etc.)
│   │   ├── currency-selector.tsx     # Currency picker
│   │   ├── business-unit-selector.tsx # BU context switcher
│   │   ├── decimal-input.tsx         # Money input (Decimal validation)
│   │   ├── date-range-picker.tsx     # Report date filter
│   │   ├── pagination.tsx            # Table pagination
│   │   └── data-table.tsx            # Reusable data table component
│   └── reports/                      # Report-specific components
│       ├── dashboard-kpi-cards.tsx   # KPI summary display
│       ├── cashflow-chart.tsx        # Cashflow trend chart
│       ├── aging-table.tsx           # Receivable/Payable aging
│       └── export-button.tsx         # Excel export trigger
├── lib/                              # Business logic & helpers
│   ├── auth.ts                       # NextAuth.js v5 configuration
│   ├── prisma.ts                     # PrismaClient singleton
│   ├── api-helpers.ts                # withAuth(), checkAccess(), apiResponse()
│   ├── audit-logger.ts               # auditLog() function
│   ├── excel-export-service.ts       # Excel file generation
│   ├── decimal-utils.ts              # Decimal.js helpers
│   ├── order-calculator.ts           # Order status calculation logic
│   ├── deposit-service.ts            # Deposit deduction logic
│   ├── cashflow-query.ts             # Cashflow report SQL/Prisma
│   ├── report-generator.ts           # Summary report logic
│   ├── validation-schemas.ts         # Zod schemas (reusable)
│   └── rbac.ts                       # Permission matrix & checks
├── types/                            # TypeScript type definitions
│   ├── index.ts                      # Main types export
│   ├── models.ts                     # Prisma model types
│   ├── api.ts                        # API request/response types
│   ├── auth.ts                       # Auth-related types
│   └── forms.ts                      # Form input types
├── prisma/                           # Database schema
│   ├── schema.prisma                 # Complete database model
│   ├── migrations/                   # Migration history
│   │   ├── migration_lock.toml
│   │   ├── 20240401000000_init/
│   │   │   └── migration.sql
│   │   ├── 20240402000000_add_audit/
│   │   │   └── migration.sql
│   │   └── ... (one dir per migration)
│   └── seed.ts                       # Database seeding script
├── public/                           # Static assets
│   ├── favicon.ico
│   ├── logo.svg
│   └── ...
├── styles/                           # Global styles (optional, mostly Tailwind)
│   └── globals.css
├── .env.example                      # Environment variable template
├── .env.local                        # Local env vars (git-ignored)
├── .gitignore
├── next.config.js                    # Next.js configuration
├── tailwind.config.ts                # Tailwind CSS configuration
├── tsconfig.json                     # TypeScript configuration
├── package.json                      # Dependencies
├── package-lock.json
├── docker-compose.yml                # Local PostgreSQL + pgAdmin
├── .dockerignore
├── README.md                         # Project overview
├── docs/                             # Documentation
│   ├── project-overview-pdr.md       # Project requirements & goals
│   ├── system-architecture.md        # Technical architecture
│   ├── code-standards.md             # Coding conventions
│   ├── codebase-summary.md           # This file
│   ├── project-roadmap.md            # Implementation phases
│   └── deployment-guide.md           # Setup & deployment
└── plans/                            # Implementation planning
    └── (generated during planning phase)
```

---

## Core Files & Purposes

### Authentication & Authorization

**`lib/auth.ts`** (60–80 LOC)
- NextAuth.js v5 configuration
- Credentials provider (email + password)
- JWT session strategy
- User role loading from DB
- Exports: `auth()` handler, `withAuth()` middleware

**`lib/api-helpers.ts`** (100–120 LOC)
- `withAuth(request)` – Extract and verify JWT session
- `checkAccess(user, action, module)` – RBAC permission check
- `apiResponse(success, data?, message?, errors?)` – Standard response format
- Exports: All three functions

**`lib/rbac.ts`** (80–100 LOC)
- Permission matrix: role → module → action → level
- Permission levels: FULL, GET_ONLY, DENY
- `hasPermission(roles, action, module)` – Union of role permissions
- Exports: Matrix, hasPermission()

### Business Logic Services

**`lib/order-calculator.ts`** (80–100 LOC)
- `recalculateOrderStatus(orderId, txClient)` – Auto-calc status after transaction
- Status logic: UNPAID → PARTIAL_PAID → PAID (+ refund variants)
- Uses Decimal for arithmetic
- Returns updated order object

**`lib/deposit-service.ts`** (90–110 LOC)
- `deductDeposit(depositId, amount, txClient)` – Atomic deduction
- Creates DepositUsage audit record
- Validates remaining balance
- Throws on insufficient funds

**`lib/deposit-edit-guard.ts`** (100–110 LOC)
- `loadDepositUsageStats(tx, depositId)` – Compute used/credited amounts and usage count
- `assertCanEditMetadata(stats)` – Reject currency/BU changes if deposit has usages
- `assertNewAmountValid(newAmount, stats)` – Reject if new amount < used amount
- `assertCanDelete(stats)` – Reject delete if deposit has any usages
- Typed error codes: LOCKED_HAS_USAGES, AMOUNT_BELOW_USED, DELETE_BLOCKED_HAS_USAGES

**`lib/cashflow-query.ts`** (100–120 LOC)
- `getCashflowReport(businessUnitId, dateFrom, dateTo, currency?)` – Query builder
- Combines RECEIPT + PAYMENT + order-linked transactions
- Groups by currency, sums by type (receipts vs payments)
- Returns structured report data

**`lib/report-generator.ts`** (120–150 LOC)
- `getSalesReport(businessUnitId, dateFrom, dateTo)` – Sales summary
- `getPurchaseReport(...)` – Purchase summary
- `getReceivableAging(...)` – Customer aging buckets
- `getPayableAging(...)` – Supplier aging buckets
- Each returns aggregated data (totals, counts)

**`lib/order-status-calculator.ts`** (80–100 LOC)
- `recalculateOrderStatus(orderId, txClient)` – Auto-calc order status using effective value
- Effective value = `amountOriginal + adjustmentTotal` (where adjustments are ORDER_ADJUSTMENT tx)
- Status logic: UNPAID/PARTIAL_PAID/PAID based on net paid vs effective
- Uses Decimal for all arithmetic; handles negative adjustments

**`lib/order-aggregates.ts`** (60–80 LOC)
- `getOrderAggregates(order, transactions)` – Compute derived fields
- Returns: `paidAmount`, `refundedAmount`, `adjustmentTotal`, `effectiveValue`, `balanceOriginal`
- Used by order detail report endpoint + UI list pages

**`lib/excel-report-utils.ts`** (100–150 LOC)
- Shared styling/formatting for Excel exports
- `applyHeaderStyle(sheet, row, columns)` – Header row styling (gray background, bold font)
- `applySubtotalStyle(sheet, row, columns)` – Subtotal row styling (yellow background)
- `applyGrandTotalStyle(sheet, row, columns)` – Grand total row styling (darker gray)
- `buildReportFilename(type, dateFrom, dateTo)` – Consistent filename convention
- `STYLES` object – Color constants (header, subtotal, grand-total)

**`lib/excel-order-reports-service.ts`** (250–300 LOC)
- `exportSalesSummary(orders, businessUnit, dateFrom, dateTo)` – Sales summary Excel
- `exportSalesDetail(orders, businessUnit, dateFrom, dateTo)` – Sales detail Excel
- `exportPurchaseSummary(orders, businessUnit, dateFrom, dateTo)` – Purchase summary Excel
- `exportPurchaseDetail(orders, businessUnit, dateFrom, dateTo)` – Purchase detail Excel
- Groups orders by customer/supplier × currency; adds subtotal rows per group, grand totals by currency
- Includes adjustment column ("GIẢM GIÁ TRỊ ĐH") with signed amounts (displayed positive)

**`lib/excel-cashflow-summary-service.ts`** (200–250 LOC)
- `exportCashflowSummary(buSections, dateFrom, dateTo)` – Hierarchical Excel III/IV structure
- Sections: III.a/b (customer receipts), IV.a/b (supplier payments)
- Special rows: bank fees, deposits, with `expenseCategory` sub-grouping
- Replaces prior DOCX export; Excel format with styled headers + totals

**`lib/excel-cashflow-helpers.ts`** (80–120 LOC)
- `groupTransactionsByCategory(transactions)` – Group standalone tx by expenseCategory
- `filterBankFeeRows(transactions)` – Extract synthetic fee rows from parent tx
- `filterDepositRows(deposits)` – Render deposit creation rows per party type
- Helper functions for cashflow service organization

### Data & Validation

**`lib/prisma.ts`** (10–15 LOC)
- PrismaClient singleton
- Lazy initialization, reuses instance in dev

**`lib/validation-schemas.ts`** (200+ LOC, split if needed)
- Zod schemas for all request types
- `createOrderSchema`, `createTransactionSchema`, etc.
- Decimal validation helper
- Exports: All schemas by name

**`lib/decimal-utils.ts`** (40–60 LOC)
- `parseDecimal(str)` – Safe string → Decimal conversion
- `formatDecimal(d, decimals)` – Format for display
- `toVnd(original, rate)` – FE-style computation (for reference)
- Exports: Utility functions

### Excel & Reports

**`lib/excel-export-service.ts`** (120–150 LOC)
- `exportOrdersToExcel(orders)` – Stream XLSX file
- `exportCashflowReport(report)` – Formatted cashflow sheet
- Uses exceljs for formatting, formulas
- Returns Buffer or Stream for Response

**`lib/audit-logger.ts`** (50–70 LOC)
- `createAuditLog(userId, action, model, recordId, changes?, txClient?)` – Log operation
- Handles JSON serialization of changes
- Integrates with Prisma $transaction
- Exports: createAuditLog()

### Database & Seeding

**`prisma/schema.prisma`** (300+ LOC)
- Complete database model (User, Order, Transaction, etc.)
- Enums: OrderStatus, PartyType, TransactionType, etc.
- Indexes on common queries
- Relations with clear ownership

**`prisma/seed.ts`** (100–150 LOC)
- Creates admin user with hashed password
- Seeds base data: BusinessUnits (TK, NT), Currencies (VND, USD, RMB)
- Runs on `prisma db seed` command

---

## Component Organization

### UI Primitives (`/components/ui/`)
- shadcn/ui components (minimal customization)
- One file per component (Button, Input, Select, Table, Dialog, etc.)
- Reusable across all pages

### Layout Components (`/components/layout/`)

**`navbar.tsx`** (60–80 LOC)
- Top navigation bar
- User profile dropdown (name, logout)
- Dark mode toggle

**`sidebar.tsx`** (80–100 LOC)
- Left sidebar navigation
- Menu items: Orders, Parties, Transactions, Cashflow, Reports, Settings
- Active state highlighting
- Collapsible on mobile

**`breadcrumb.tsx`** (30–40 LOC)
- Dynamic breadcrumb based on route
- Links to parent pages

### Shared Business Components (`/components/shared/`)

**`party-form.tsx`** (80–100 LOC)
- Create/Edit form for Customer or Supplier
- Fields: name, type, email, phone, address, taxId
- Handles both POST (create) and PATCH (update)
- Error display

**`order-form.tsx`** (100–120 LOC)
- Create/Edit sale or purchase order
- Fields: party, amount (Decimal input), currency, date, notes
- Integrates `DecimalInput` component
- Business unit scoped

**`transaction-form.tsx`** (110–130 LOC)
- Create/Edit payment, receipt, or refund
- Type selection (SALE_PAYMENT, PURCHASE_PAYMENT, RECEIPT, PAYMENT)
- Payment method: Bank or Deposit
- Multi-currency: amountOriginal + exchangeRate → amountVnd
- Deposit auto-lookup if applicable

**`decimal-input.tsx`** (50–70 LOC)
- Text input with Decimal validation
- Shows error if invalid format
- onBlur: format to 4 decimals
- Props: value, onChange, label, error

**`order-status-badge.tsx`** (30–50 LOC)
- Display order status with color coding
- UNPAID: red, PARTIAL_PAID: orange, PAID: green
- Uses shadcn Badge component

**`currency-selector.tsx`** (40–50 LOC)
- Dropdown to switch active currency filter
- Fetches list from API
- Props: value, onChange

**`business-unit-selector.tsx`** (40–50 LOC)
- Dropdown to switch business unit context
- Updates local state → re-fetches data
- TK, NT, etc.

**`data-table.tsx`** (80–100 LOC)
- Generic reusable table with sorting, filtering, pagination
- Props: columns, data, onRowClick
- Uses shadcn Table + pagination

### Report Components (`/components/reports/`)

**`dashboard-kpi-cards.tsx`** (60–80 LOC)
- Grid of KPI cards: Total Receivable, Payable, Cash, Recent Txns
- Real-time fetch from /api/reports/dashboard
- Number formatting with separators

**`cashflow-chart.tsx`** (70–90 LOC)
- Recharts line chart: receipts vs payments over time
- Props: report data
- Color-coded (receipts green, payments red)

**`aging-table.tsx`** (60–80 LOC)
- Table: customer/supplier aging buckets (current, 30, 60, 90+ days)
- Color-coded urgency

**`export-button.tsx`** (40–50 LOC)
- Button triggering Excel download
- Calls POST /api/reports/[type]/export
- Shows loading state, handles errors

---

## Key Files by Feature

### Sales Module
- Route: `/app/api/orders` (POST/GET for SALE type)
- Components: `OrderForm`, `OrderStatusBadge`, `DataTable`
- Logic: `OrderCalculator`, `DepositService`

### Purchases Module
- Route: `/app/api/orders` (POST/GET for PURCHASE type)
- Components: `OrderForm`, `OrderStatusBadge`
- Logic: `OrderCalculator`, `DepositService`

### Cashflow Module
- Route: `/app/api/transactions`, `/app/api/cashflow-report`
- Components: `TransactionForm`, `CashflowChart`
- Logic: `CashflowQuery`

### Reports Module
- Routes: `/app/api/reports/summary`, `/app/api/reports/dashboard`
- Components: `DashboardKpiCards`, `CashflowChart`, `AgingTable`, `ExportButton`
- Logic: `ReportGenerator`, `ExcelExportService`

### Settings Module
- Routes: `/app/api/business-units`, `/app/api/currencies`, `/app/api/users`, `/app/api/audit-logs`
- Components: Various forms for CRUD
- RBAC: ADMIN only for users/audit

---

## Naming Conventions

| Type | Convention | Example |
|------|-----------|---------|
| Functions | camelCase | `recalculateOrderStatus()`, `createAuditLog()` |
| Classes | PascalCase | (rare; mostly functional) |
| Constants | UPPER_SNAKE_CASE | `MAX_UPLOAD_SIZE`, `DEFAULT_PAGE_LIMIT` |
| Types/Interfaces | PascalCase | `Order`, `CreateOrderInput`, `ApiResponse<T>` |
| React Components | PascalCase | `OrderForm`, `DashboardKpiCards` |
| Files (TS/TSX) | kebab-case | `order-form.tsx`, `order-calculator.ts` |
| Files (Prisma) | schema.prisma, seed.ts | (standard names) |
| Enums (Prisma) | PascalCase | `OrderStatus`, `PartyType` |
| Enum values | UPPER_SNAKE_CASE | `UNPAID`, `PARTIAL_PAID` |

---

## Import Organization

**Rule:** Group imports in this order:
1. External packages (React, Next.js, etc.)
2. Internal libs (lib/*.ts)
3. Internal components (components/*)
4. Internal types (types/*)
5. Styles (CSS imports)

```typescript
// ✅ Good
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

import { withAuth, checkAccess, apiResponse } from '@/lib/api-helpers';
import { prisma } from '@/lib/prisma';
import { createOrderSchema } from '@/lib/validation-schemas';

import { OrderForm } from '@/components/shared/order-form';
import { Button } from '@/components/ui/button';

import type { Order, ApiResponse } from '@/types';

import '@/styles/globals.css';
```

---

## Development Workflow

1. **Start local dev:**
   ```bash
   docker-compose up -d
   npm install
   npx prisma migrate dev
   npm run dev
   ```

2. **Create new feature:**
   - Add types in `types/index.ts`
   - Add Prisma model in `schema.prisma` (if needed)
   - Create zod schema in `lib/validation-schemas.ts`
   - Implement API route in `app/api/...`
   - Create React component(s) in `components/...`

3. **Before merge:**
   - Check file sizes < 200 LOC
   - Verify TypeScript compilation: `npm run build`
   - Run tests (when implemented)
   - Code review checklist in `/docs/code-standards.md`

---

## Related Documentation

- `/docs/project-overview-pdr.md` – Requirements by module
- `/docs/system-architecture.md` – Data model diagram, API structure
- `/docs/code-standards.md` – Implementation patterns and review checklist
- `/docs/project-roadmap.md` – Implementation phases

