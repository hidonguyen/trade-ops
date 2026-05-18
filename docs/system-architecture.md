# System Architecture – Trade Ops
## Technical Design & Data Model

**Status:** Design Phase
**Last Updated:** 2026-04-02
**Version:** 1.0

---

## Architecture Overview

Trade Ops follows a fullstack Next.js monolithic architecture with clear separation:
- **Frontend** – React components, TypeScript, Tailwind CSS + shadcn/ui
- **API Layer** – Next.js Route Handlers (app/api/*), RESTful JSON
- **Business Logic** – Service layer (lib/) with Prisma ORM, zod validation, audit logging
- **Database** – PostgreSQL with Prisma 5.10+
- **Auth** – NextAuth.js v5 with JWT sessions and role-based access control

```
┌─────────────────────────────────────────────┐
│   Browser / Client (React + Tailwind)       │
└─────────────────┬───────────────────────────┘
                  │ HTTP/JSON
┌─────────────────▼───────────────────────────┐
│  Next.js App Router                         │
│  ├─ /app/(auth) – Login page                │
│  ├─ /app/(dashboard) – Protected routes     │
│  └─ /app/api – Route Handlers               │
└─────────────────┬───────────────────────────┘
                  │ TypeScript
┌─────────────────▼───────────────────────────┐
│  Service Layer (/lib)                       │
│  ├─ auth.ts – NextAuth config               │
│  ├─ prisma.ts – PrismaClient singleton      │
│  ├─ api-helpers.ts – withAuth, checkAccess  │
│  ├─ audit.ts – AuditLog creation            │
│  └─ excel.ts – Excel export                 │
└─────────────────┬───────────────────────────┘
                  │ ORM
┌─────────────────▼───────────────────────────┐
│  PostgreSQL Database                        │
│  ├─ Users, Roles                            │
│  ├─ Orders, Transactions                    │
│  ├─ Deposits, Parties                       │
│  └─ AuditLogs                               │
└─────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| **Framework** | Next.js | 14+ (App Router) |
| **Language** | TypeScript | Latest |
| **Database** | PostgreSQL | 14+ |
| **ORM** | Prisma | 5.10+ |
| **Auth** | NextAuth.js | v5 |
| **UI Framework** | React | 18+ |
| **Styling** | Tailwind CSS | Latest |
| **Components** | shadcn/ui | Latest |
| **Validation** | zod | Latest |
| **Money Math** | Decimal.js | Latest |
| **Excel Export** | exceljs | Latest |
| **Charts** | recharts | Latest |
| **Password Hashing** | bcrypt | (via NextAuth) |

---

## Data Model Overview

### Core Entities & Relationships

```
User (1) ──────────────────────── (M) UserRoleAssignment ──(M) Role
 │
 └─────────────────────────────── (M) AuditLog

BusinessUnit (1) ──(M) Currency
              └─(M) ExpenseType
              └─(M) Party
              └─(M) Order
              └─(M) Transaction
              └─(M) Deposit

Party (1) ──────────(M) Order
       └─────────────(M) Deposit

Order (1) ──────────(M) Transaction
       └─────────────(M) DepositUsage

Deposit (1) ─────────(M) DepositUsage
        └────────────(M) Transaction
```

### User & Access Control

**User**
- `id: String @id @default(uuid(7))` – Unique identifier
- `email: String @unique` – Login credential
- `name: String` – Display name
- `passwordHash: String` – Hashed via bcrypt
- `isActive: Boolean @default(true)` – Soft delete
- `createdAt, updatedAt: DateTime` – Timestamps
- Relation: `roles: UserRoleAssignment[]`

**UserRoleAssignment**
- `id: String @id @default(uuid(7))`
- `userId: String` – Foreign key to User
- `role: String` – Enum: ADMIN, ACCOUNTANT_SALE, ACCOUNTANT_PURCHASE, ACCOUNTANT_CASHFLOW, VIEWER
- `businessUnitId: String?` – Foreign key to BusinessUnit; `null` = global scope (ADMIN convention)
- `assignedAt, assignedBy: DateTime, String` – Audit fields
- Unique constraint: `(userId, role, businessUnitId)`

A role is scoped to one Business Unit. A user holds a **single role** applied across the set of BUs it is granted — one `UserRoleAssignment` row per BU, all sharing the same `role`. ADMIN is global — one row with `businessUnitId = null` grants every BU.

**AuditLog**
- `id: String @id @default(uuid(7))`
- `userId: String` – Who performed action
- `action: String` – Enum: CREATE, UPDATE, DELETE
- `model: String` – Entity name (e.g., "Order", "Transaction")
- `recordId: String` – PK of modified record
- `changes: Json` – `{ before?: {}, after?: {} }` for UPDATE
- `timestamp: DateTime @default(now())`
- Index: `(recordId, model)`, `(userId, timestamp)`

### Business Configuration

**BusinessUnit**
- `id: String @id @default(uuid(7))`
- `code: String @unique` – TK, NT, etc. (2-3 chars)
- `name: String` – Full name
- `isActive: Boolean @default(true)`

**Currency**
- `id: String @id @default(uuid(7))`
- `code: String @unique` – VND, USD, RMB (3 chars, ISO 4217)
- `name: String`
- `symbol: String` – ₫, $, ¥
- `isActive: Boolean @default(true)`

**ExpenseType**
- `id: String @id @default(uuid(7))`
- `name: String` – Utilities, Salary, Rent, etc.
- `isActive: Boolean @default(true)`

### Party Management

**Party (CUSTOMER or SUPPLIER)**
- `id: String @id @default(uuid(7))`
- `businessUnitId: String` – FK to BusinessUnit (scope data by unit)
- `name: String`
- `type: String` – Enum: CUSTOMER, SUPPLIER
- `address, phone, email: String` – Contact info
- `taxId: String` – Optional tax ID
- `isActive: Boolean @default(true)`
- Relations: `orders[]`, `deposits[]`

**Deposit**
- `id: String @id @default(uuid(7))`
- `partyId: String` – FK to Party (customer prepayment or supplier advance)
- `businessUnitId: String` – FK to BusinessUnit
- `currencyId: String` – FK to Currency
- `amountOriginal: Decimal @db.Decimal(18, 4)` – Deposit amount in original currency
- `remainingOriginal: Decimal @db.Decimal(18, 4)` – Remaining balance
- `createdAt, updatedAt: DateTime`
- Relations: `usages: DepositUsage[]`, `transactions: Transaction[]`

**DepositUsage**
- `id: String @id @default(uuid(7))`
- `depositId, transactionId: String` – FKs (atomic pair)
- `amountOriginal: Decimal @db.Decimal(18, 4)` – Amount deducted from deposit
- `createdAt: DateTime`
- Index: `(depositId)`, `(transactionId, depositId)` for fast audit

### Orders & Transactions

**Order (SALE or PURCHASE)**
- `id: String @id @default(uuid(7))`
- `businessUnitId, partyId: String` – FKs
- `type: String` – Enum: SALE, PURCHASE
- `status: String` – Enum: UNPAID, PARTIAL_PAID, PAID, PARTIAL_REFUNDED, REFUNDED
- `amountOriginal: Decimal @db.Decimal(18, 4)`
- `currencyId: String` – FK to Currency
- `exchangeRate: Decimal @db.Decimal(18, 8)` – VND exchange rate; default 1; used for client-side VND display
- `paymentDueDate: DateTime?` – Expected payment date; nullable
- `expenseTypeId: String?` – FK to ExpenseType (for PURCHASE orders only; null for SALE)
- `orderDate: DateTime`
- `notes: String` – Optional
- `paidAmount: Decimal @db.Decimal(18, 4)` – Calculated; sum of transactions with paymentType='PAYMENT'
- `refundedAmount: Decimal @db.Decimal(18, 4)` – Calculated; sum of transactions with paymentType='REFUND'
- `createdAt, updatedAt, createdBy: DateTime, String` – Audit
- Relations: `transactions: Transaction[]`, `expenseType?: ExpenseType`
- **Derived Fields** (computed from transactions):
  - `adjustmentTotal` = Σ(amountOriginal where paymentType='ADJUSTMENT') [can be negative]
  - `effectiveValue` = amountOriginal + adjustmentTotal
  - `balance` = max(effectiveValue - paidAmount + refundedAmount, 0)

**Transaction (payment, receipt, or order adjustment)**
- `id: String @id @default(uuid(7))`
- `orderId: String` – FK (nullable; for standalone RECEIPT/PAYMENT)
- `businessUnitId: String` – FK (used if orderId is null for cashflow query)
- `type: String` – Enum: SALE_PAYMENT, PURCHASE_PAYMENT, RECEIPT, PAYMENT, ORDER_ADJUSTMENT
- `paymentMethod: String` – Enum: BANK, DEPOSIT (nullable for ORDER_ADJUSTMENT)
- `paymentType: String` – Enum: PAYMENT, REFUND, ADJUSTMENT
- `amountOriginal: Decimal @db.Decimal(18, 4)` – Amount in original currency (can be negative for ORDER_ADJUSTMENT)
- `currencyId: String` – FK to Currency
- `amountVnd: Decimal @db.Decimal(18, 4)` – Amount in VND (received from client, never computed)
- `exchangeRate: Decimal @db.Decimal(18, 8)` – Rate used by client (informational only)
- `bankReference: String` – Bank tx ID or memo
- `transactionDate: DateTime`
- `notes: String`
- `bankFeeOriginal, bankFeeVnd: Decimal?` – Bank fee borne by company (only for BANK method)
- `expenseTypeId: String?` – FK to ExpenseType (for standalone RECEIPT/PAYMENT, or PURCHASE order expense category)
- `createdAt, createdBy: DateTime, String`
- Relations: `order?: Order`, `expenseType?: ExpenseType`, `deposits: DepositUsage[]`
- Indexes: `(orderId, type)`, `(businessUnitId, type, transactionDate)`, `(expenseTypeId)`

---

## API Route Structure

All routes follow RESTful JSON pattern: `{ success: boolean, data?: T, message?: string, errors?: Record<string, string[]> }`

```
/api
├── /auth/[...nextauth]           # NextAuth.js callbacks
├── /business-units               # GET (list), POST (create)
│   └── /[id]                     # PATCH (update), DELETE
├── /currencies                   # GET (list), POST (create)
│   └── /[id]                     # PATCH, DELETE
├── /expense-types                # GET, POST, /[id]: PATCH, DELETE
├── /parties                       # GET (list), POST (create customer/supplier)
│   └── /[id]                     # PATCH (edit), DELETE, GET (detail)
│       └── /deposits             # POST (create deposit)
├── /deposits                      # GET (list), detailed balance view
│   └── /[id]                     # PATCH, DELETE
├── /orders                        # GET (sales + purchases), POST (create)
│   └── /[id]                     # PATCH (edit), GET (detail with summary)
│       ├── /status               # GET (current status)
│       ├── /transactions         # GET (linked txns)
│       │   └── /[txId]           # POST (create), PATCH, DELETE
│       └── /report               # GET (order summary: paid, refunded, due)
├── /transactions                  # GET (standalone only), POST (create receipt/payment)
│   └── /[id]                     # PATCH (edit), DELETE
├── /cashflow-report              # GET (?businessUnitId, dateFrom, dateTo, currency)
├── /reports/summary              # GET (sales/purchase/receivable/payable summaries)
│   └── /[type]                   # GET specific report
├── /reports/dashboard            # GET (KPI cards)
├── /users                         # GET (list), POST (create)
│   └── /[id]                     # PATCH (assign roles), DELETE (deactivate)
└── /audit-logs                    # GET (list with filters), no write ops
```

---

## Authentication & Authorization Flow

### 1. Login
```
POST /api/auth/callback/credentials
├─ email, password
├─ bcrypt.compare(password, user.passwordHash)
├─ Create JWT session (NextAuth v5)
└─ Set httpOnly cookie
```

### 2. Protected Request
```
GET /api/orders
├─ Middleware reads JWT from cookie
├─ Extract user.id, roles
├─ withAuth() middleware verifies token
├─ checkAccess() evaluates RBAC rules
├─ If denied → 403 Forbidden
└─ If allowed → proceed to handler
```

### 3. RBAC Decision Logic
```
checkAccess(assignments, action, module, businessUnitId) → boolean
├─ For each assignment in user.roles ({ role, businessUnitId }):
│   ├─ Skip unless assignment is global (null) OR matches target businessUnitId
│   ├─ Check permission matrix[role][module]
│   ├─ FULL > GET (action GET only) > DENY
│   └─ Return true if any matching assignment grants access
└─ Default deny
```

Every API handler resolves the **target Business Unit** before checking:
- Mutations / reads of a record → the record's `businessUnitId`.
- Admin-only modules (users, currencies, BUs, expense types, audit logs) → `null` (global).
- Cross-BU reports (no BU param) → `checkAccessAnyBu()` gates entry, then
  `accessibleBusinessUnits()` narrows the result set to permitted BUs.

`lib/rbac.ts` helpers: `checkAccess`, `checkAccessAnyBu`, `accessibleBusinessUnits`,
`isAdmin`. Unit-tested in `lib/rbac.test.ts` (`npm test`).

---

## Key Business Logic Patterns

### Pattern 1: Order Status Auto-Recalculation

**Trigger:** After any Transaction add/edit/delete (including ORDER_ADJUSTMENT)

**Logic:**
```typescript
async function recalculateOrderStatus(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { transactions: true }
  });
  
  const paidAmount = order.transactions
    .filter(t => t.paymentType === 'PAYMENT')
    .reduce((sum, t) => sum.plus(t.amountOriginal), new Decimal(0));
  
  const refundedAmount = order.transactions
    .filter(t => t.paymentType === 'REFUND')
    .reduce((sum, t) => sum.plus(t.amountOriginal), new Decimal(0));
  
  // NEW: Calculate adjustment total (can be negative)
  const adjustmentTotal = order.transactions
    .filter(t => t.paymentType === 'ADJUSTMENT')
    .reduce((sum, t) => sum.plus(t.amountOriginal), new Decimal(0));
  
  // NEW: Effective value includes adjustments
  const effectiveValue = order.amountOriginal.plus(adjustmentTotal);
  
  const netPaid = paidAmount.minus(refundedAmount);
  
  let status = 'UNPAID';
  if (netPaid.greaterThan(0) && netPaid.lessThan(effectiveValue)) {
    status = 'PARTIAL_PAID';
  } else if (netPaid.greaterThanOrEqualTo(effectiveValue)) {
    status = 'PAID';
  }
  // Handle refunds...
  
  await prisma.order.update({
    where: { id: orderId },
    data: { status, paidAmount, refundedAmount }
  });
}
```
**Note:** paidAmount and refundedAmount are NOT modified by adjustments; they remain sums of PAYMENT/REFUND transactions only. Adjustments modify the order's **effective value**, not the paid amount.

### Pattern 2: Atomic Deposit Deduction

**Trigger:** Create Transaction with paymentMethod === 'DEPOSIT'

**Logic:**
```typescript
await prisma.$transaction(async (tx: any) => {
  // 1. Create transaction
  const transaction = await tx.transaction.create({
    data: { /* ... */ }
  });
  
  // 2. Decrement deposit
  const deposit = await tx.deposit.update({
    where: { id: depositId },
    data: {
      remainingOriginal: {
        decrement: amountOriginal
      }
    }
  });
  
  // 3. Create audit entry
  await tx.depositUsage.create({
    data: {
      depositId,
      transactionId: transaction.id,
      amountOriginal
    }
  });
  
  return { transaction, deposit };
});
```

### Pattern 3: Cashflow Report Query

**Query:** All money in/out for period, grouped by currency

**Logic:**
```typescript
// Get all transactions:
// - RECEIPT + PAYMENT (direct on businessUnitId)
// - SALE_PAYMENT + PURCHASE_PAYMENT (via order.businessUnitId)

const transactions = await prisma.transaction.findMany({
  where: {
    transactionDate: { gte: dateFrom, lte: dateTo },
    OR: [
      { businessUnitId },
      { order: { businessUnitId } }
    ]
  },
  include: { currency: true, order: true }
});

// Group by currency, sum RECEIPT vs PAYMENT
```

---

## Decimal.js Money Handling

**Rule:** Never use `number` or `float` for monetary values.

**Frontend:**
```typescript
// Client computes VND equivalent
const amountVnd = new Decimal(amountOriginal)
  .times(exchangeRate)
  .toDecimalPlaces(4);

// Send both to API
const payload = {
  amountOriginal: new Decimal('1000.00').toString(), // string
  amountVnd: amountVnd.toString(),
  exchangeRate: rate.toString()
};
```

**Backend:**
```typescript
import Decimal from 'decimal.js';

// Receive as string, parse to Decimal
const amount = new Decimal(payload.amountOriginal);

// Never compute rate; store as-is from client
const stored = {
  amountOriginal: amount,
  amountVnd: new Decimal(payload.amountVnd),
  exchangeRate: new Decimal(payload.exchangeRate)
};

// Arithmetic
const sum = amount1.plus(amount2);
const diff = amount1.minus(amount2);
const rate = amountVnd.dividedBy(amountOriginal);
```

---

## Error Handling & API Responses

### Success Response
```json
{
  "success": true,
  "data": { /* entity or list */ }
}
```

### Validation Error
```json
{
  "success": false,
  "message": "Validation failed",
  "errors": {
    "email": ["Invalid email format"],
    "amount": ["Must be greater than 0"]
  }
}
```

### Authorization Error (403)
```json
{
  "success": false,
  "message": "Access denied"
}
```

### Server Error (500)
```json
{
  "success": false,
  "message": "Internal server error"
}
```

---

## Scaling Considerations

1. **Database Indexing** – All foreign keys, `transactionDate`, `status` columns indexed
2. **Pagination** – Standard `?page=1&limit=50&sortBy=createdAt&order=desc`
3. **Caching** – Dashboard KPIs cached 5 minutes (user-specific)
4. **Query Optimization** – Use `select` and `include` judiciously; avoid N+1
5. **Connection Pooling** – PgBouncer (3–5 connections per user type)

---

## Security Measures

1. **HTTPS** – Enforced in production
2. **CORS** – Same-origin only (no wildcards)
3. **CSRF** – NextAuth handles via token validation
4. **XSS** – React auto-escapes; CSP headers in production
5. **SQL Injection** – Prisma parameterized queries
6. **Password** – bcrypt hashing, never stored in plain text
7. **JWT Expiry** – 30-day sessions with refresh handling
8. **Rate Limiting** – Configure per API (e.g., 100 req/min per IP)

---

## Caching Layer

In-process LRU cache with tag-based invalidation. Module: `lib/cache/`.

**What's cached (read-through via `withCache`):**

| Endpoint | Tag(s) | TTL |
|----------|--------|-----|
| `GET /api/currencies` | `catalog:currencies` | 10min |
| `GET /api/business-units` | `catalog:business-units` | 10min |
| `GET /api/expense-types` | `catalog:expense-types` | 10min |
| `GET /api/parties` (all filter combos) | `catalog:parties` | 5min |
| `GET /api/reports/dashboard` | `reports:bu:{buId}`, `reports:dashboard` | 60s |
| `GET /api/reports/summary` | `reports:bu:{buId}`, `reports:summary` | 60s |
| `GET /api/reports/expense-type-summary` | `reports:bu:{buId}`, `reports:expense-type` | 60s |
| `GET /api/users` + `[id]` | `catalog:users`, `user:{id}` | 5min |
| `GET /api/parties/[id]` | `party:{id}`, `party:{id}:deposits` | 2min |
| `GET /api/parties/[id]/deposits` | `party:{id}:deposits` | 60s |
| `GET /api/orders/[id]` | `order:{id}` | 30s |
| `GET /api/orders/[id]/transactions` | `order:{id}` | 30s |
| `GET /api/orders/[id]/report` | `order:{id}` | 60s |

**Not cached:** orders/transactions/audit-logs LIST endpoints (dynamic filter explosion), auth, cashflow & bank-fees reports (xlsx branching — future work).

**Invalidation:** Mutation handlers call `invalidateTags(...)` AFTER the DB transaction commits.

| Mutation | Invalidates |
|----------|-------------|
| Currency CRUD | `catalog:currencies` |
| Business-unit CRUD | `catalog:business-units` |
| Expense-type CRUD | `catalog:expense-types`, `reports:expense-type` |
| Party CRUD | `catalog:parties`, `reports:bu:{buId}` (on edit/delete) |
| Order POST/PATCH | `reports:bu:{buId}` |
| Transaction POST/PATCH/DELETE (standalone + order-nested) | `reports:bu:{buId}`; `order:{orderId}` (order-nested); `party:{partyId}:deposits` (deposit-funded) |
| User CRUD | `catalog:users`, `user:{id}` |
| Deposit POST | `party:{partyId}:deposits`, `party:{partyId}`, `reports:bu:{buId}` |

60s TTL on reports caps worst-case staleness if any invalidation path is missed.

**Toggle / operations:**
- `CACHE_ENABLED=false` — disables all caching (debugging).
- `CACHE_DRIVER=lru` (default) — in-process. Swappable via `CacheStore` interface.
- `GET /api/admin/cache-stats` — ADMIN-only stats (size, hits, misses, hit-ratio, tagCount).
- `POST /api/admin/cache-stats?action=clear` — flush all entries.

**Upgrade path (multi-replica):** Implement `RedisCacheStore` satisfying `CacheStore` interface, flip `CACHE_DRIVER=redis` in `lib/cache/index.ts`. Current LRU assumes single-container deployment; multi-replica will see cache divergence.

**Memory cap:** 500 entries (LRU eviction). Tag index self-cleans via `dispose` hook.

---

## Related Documentation

- `/docs/code-standards.md` – Implementation patterns
- `/docs/project-overview-pdr.md` – Functional requirements
- `/docs/deployment-guide.md` – Database setup, env vars

