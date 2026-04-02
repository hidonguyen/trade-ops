# Phase 2: Catalog + Party + Deposit APIs

## Context Links
- [System Architecture](../../docs/system-architecture.md) -- API route structure, Party/Deposit models
- [Code Standards](../../docs/code-standards.md) -- route handler pattern, zod validation
- [Wireframe: Parties](../../docs/wireframes/05-parties.html)
- [Wireframe: Deposits](../../docs/wireframes/07-deposits.html)
- [Wireframe: Settings](../../docs/wireframes/04-settings-users.html)

## Overview
- **Priority:** P1
- **Status:** Complete
- **Effort:** 5h
- **Blocked by:** Phase 1
- **Blocks:** Phase 6
- **Parallel with:** Phases 3, 4, 5
- **Description:** Implement CRUD API routes for BusinessUnit, Currency, ExpenseType, Party, and Party Deposits. All routes follow withAuth > checkAccess > zod > prisma > auditLog > apiResponse pattern.

## Key Insights
- BusinessUnit/Currency/ExpenseType are ADMIN-only for write, all roles can read
- Party has type: CUSTOMER | SUPPLIER | BOTH -- filter by type in list queries
- Deposits are created under a Party (`/parties/[id]/deposits`) -- scoped by businessUnit
- All Decimal fields in Deposit: amountOriginal, remainingOriginal
- Soft delete pattern: set `isActive = false`, never hard delete

## File Ownership (Exclusive)

```
app/api/business-units/route.ts
app/api/business-units/[id]/route.ts
app/api/currencies/route.ts
app/api/currencies/[id]/route.ts
app/api/expense-types/route.ts
app/api/expense-types/[id]/route.ts
app/api/parties/route.ts
app/api/parties/[id]/route.ts
app/api/parties/[id]/deposits/route.ts
```

## Implementation Steps

### 1. Business Unit Routes (0.5h)
1. `app/api/business-units/route.ts`
   - GET: List all active BUs (all roles)
   - POST: Create BU (ADMIN only), zod validate {code, name}
2. `app/api/business-units/[id]/route.ts`
   - PATCH: Update BU (ADMIN only)
   - DELETE: Soft delete (set isActive=false, ADMIN only)

### 2. Currency Routes (0.5h)
1. `app/api/currencies/route.ts`
   - GET: List all active currencies
   - POST: Create currency (ADMIN only), validate {code, name, symbol}
2. `app/api/currencies/[id]/route.ts`
   - PATCH: Update currency (ADMIN only)
   - DELETE: Soft delete (ADMIN only)

### 3. Expense Type Routes (0.5h)
1. `app/api/expense-types/route.ts`
   - GET: List all active expense types
   - POST: Create (ADMIN only), validate {name}
2. `app/api/expense-types/[id]/route.ts`
   - PATCH: Update (ADMIN only)
   - DELETE: Soft delete (ADMIN only)

### 4. Party Routes (2h)
1. `app/api/parties/route.ts`
   - GET: List parties with filters (?type=CUSTOMER|SUPPLIER|BOTH, ?businessUnitId, ?search, pagination)
   - POST: Create party, validate {name, type, businessUnitId, address?, phone?, email?, taxId?}
   - RBAC: CUSTOMER dimension for type=CUSTOMER, SUPPLIER dimension for type=SUPPLIER
2. `app/api/parties/[id]/route.ts`
   - GET: Party detail with deposit summary (total deposited, remaining)
   - PATCH: Update party fields
   - DELETE: Soft delete
3. Audit log on every CREATE/UPDATE/DELETE

### 5. Party Deposit Routes (1.5h)
1. `app/api/parties/[id]/deposits/route.ts`
   - GET: List deposits for party (with remaining balances)
   - POST: Create deposit, validate {currencyId, amountOriginal, businessUnitId}
   - On create: set `remainingOriginal = amountOriginal`
   - RBAC: follows party's type dimension (CUSTOMER or SUPPLIER)
2. Audit log on deposit creation

## Zod Schemas (defined in lib/validation-schemas.ts from Phase 1)

```typescript
createBusinessUnitSchema: { code: string(2-3), name: string }
createCurrencySchema: { code: string(3), name: string, symbol: string }
createExpenseTypeSchema: { name: string }
createPartySchema: { name, type: CUSTOMER|SUPPLIER|BOTH, businessUnitId, address?, phone?, email?, taxId? }
createDepositSchema: { currencyId, amountOriginal: decimalString, businessUnitId }
```

## Todo Checklist

- [x] Business unit GET/POST route
- [x] Business unit PATCH/DELETE route
- [x] Currency GET/POST route
- [x] Currency PATCH/DELETE route
- [x] Expense type GET/POST route
- [x] Expense type PATCH/DELETE route
- [x] Party GET (list with filters + pagination) / POST route
- [x] Party GET (detail) / PATCH / DELETE route
- [x] Party deposit GET / POST route
- [x] Audit logs on all write operations
- [x] RBAC enforced on all routes
- [x] Zod validation on all request bodies
- [x] Verify: all routes return standard apiResponse format

## Success Criteria
1. All 9 route files compile without errors
2. CRUD operations work for all 5 entities
3. RBAC: non-ADMIN cannot write to BU/Currency/ExpenseType
4. RBAC: ACCT_SALE can write CUSTOMER parties, read-only SUPPLIER
5. Pagination works on party list: `?page=1&limit=50&sortBy=name&order=asc`
6. Deposits created with correct remainingOriginal = amountOriginal
7. Audit log entry exists for every write operation

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Party type-based RBAC complexity | Medium | Medium | Map CUSTOMER->CUSTOMER dimension, SUPPLIER->SUPPLIER dimension, BOTH->check both |
| Deposit remaining balance race condition | Low | High | Use prisma.$transaction for deposit creation |
| Soft delete leaking inactive records | Medium | Low | Default filter `where: { isActive: true }` on all list queries |

## Security Considerations
- All routes wrapped in withAuth() -- no public access
- checkAccess() enforces role-based permissions per module
- Zod validates all inputs before DB operations
- No raw SQL -- Prisma parameterized queries only
