# Trade Ops Full Codebase Review

**Date:** 2026-04-02
**Reviewer:** code-reviewer
**Scope:** Backend (23 API routes, 9 lib modules), Frontend (26 pages, 32 components), Prisma schema
**LOC:** ~4,500 estimated

---

## Overall Assessment

The codebase is well-structured with consistent patterns: auth on every route, Zod validation on all write endpoints, Decimal.js for monetary math, prisma.$transaction for multi-step ops, and audit logging on every mutation. RBAC implementation is thorough. However, there are **two critical functional bugs** that will break core user flows in production.

---

## Critical Issues (Blocking)

### C1. PaymentForm missing `type` field — all order payments will fail validation

**File:** `components/payment-form.tsx` (line 131-141)
**Impact:** Every attempt to create an order-linked payment from the UI will return 400.

The `createOrderTransactionSchema` (lib/validation-schemas.ts:101) requires `type: z.enum(["SALE_PAYMENT", "PURCHASE_PAYMENT"])`. The `PaymentForm` component constructs a payload with `paymentType`, `paymentMethod`, `amountOriginal`, etc. but **never includes `type`**.

**Fix:** Derive `type` from the order type. The component receives order context via props — add an `orderType` prop and compute:
```typescript
// In payload construction:
type: orderType === "SALE" ? "SALE_PAYMENT" : "PURCHASE_PAYMENT",
```
Also update `OrderDetailPage` (`app/(dashboard)/orders/[id]/page.tsx`) to pass `orderType={order.type}` to `PaymentForm`.

### C2. TransactionForm deposit loading hits nonexistent endpoint

**File:** `components/transaction-form.tsx` (line 102)
**Impact:** Standalone transaction deposit selection will always fail with 404.

The form fetches `/api/business-units/${form.businessUnitId}/deposits` when payment method is DEPOSIT. This API route does **not exist** — deposits are nested under parties (`/api/parties/[id]/deposits`).

**Fix options:**
1. Create a new `/api/business-units/[id]/deposits` route that fetches all deposits for a given business unit
2. Or change the form to first select a party, then load deposits from `/api/parties/${partyId}/deposits`

---

## Important Issues (High Priority)

### H1. Unvalidated `sortBy` parameter allows Prisma errors

**File:** `lib/api-helpers.ts` (line 73)
**Impact:** User-supplied `sortBy` passed directly to Prisma `orderBy`. Invalid column names cause 500 errors with Prisma error details in server logs.

While not SQL injection (Prisma validates column names), it should be allowlisted:
```typescript
const ALLOWED_SORT_FIELDS = ["createdAt", "updatedAt", "name", "orderDate", "transactionDate", "code"];
const sortBy = ALLOWED_SORT_FIELDS.includes(searchParams.get("sortBy") || "")
  ? searchParams.get("sortBy")!
  : "createdAt";
```

### H2. Most API routes don't handle malformed JSON body gracefully

**Files:** All POST/PATCH routes except `app/api/users/route.ts` and `app/api/users/[id]/route.ts`
**Impact:** Sending non-JSON body (e.g., form-encoded) causes `request.json()` to throw, caught by outer try-catch as 500 instead of 400.

The user routes correctly wrap `request.json()` in try-catch returning 400. All other routes should do the same, or extract to a shared helper.

### H3. JWT roles are cached for 30 days — role changes not reflected until re-login

**File:** `lib/auth.ts` (line 61)
**Impact:** If admin changes a user's roles, the change won't take effect until the user's JWT expires (30 days).

The JWT callback only writes roles on initial sign-in (`if (user)`). Consider:
- Reducing `maxAge` to 24h or less
- Or refreshing roles from DB in the JWT callback periodically

### H4. Order status calculator edge case: overpayment produces wrong status

**File:** `lib/order-status-calculator.ts` (lines 31-40)
**Impact:** If `netPaid > orderAmount` and there are refunds, the status logic enters the PAID branch (line 37: `netPaid.greaterThanOrEqualTo(orderAmount)`), but PARTIAL_REFUNDED check (line 34) is evaluated first only when `netPaid < orderAmount`. An overpaid order with a partial refund that still leaves netPaid >= orderAmount stays PAID. This may be acceptable business logic, but should be verified.

### H5. ACCOUNTANT_CASHFLOW has DENY on RECEIPT and PAYMENT in sidebar nav

**File:** `lib/api-helpers.ts` (lines 43-44)
**Impact:** Looking at the permission matrix:
- ACCOUNTANT_CASHFLOW: RECEIPT = "FULL", PAYMENT = "FULL"
This is correct. No issue here — sidebar filters by `adminOnly` only, not per-module RBAC, so ACCOUNTANT_CASHFLOW can access Receipt/Payment pages. However, this means the sidebar shows **all non-admin nav items** to all roles, including pages they may get 403 on (e.g., VIEWER seeing "Giao dich" but getting 403 on creating transactions). Consider client-side nav filtering by actual RBAC permissions.

---

## Minor Issues

### M1. `request.json()` error handling inconsistency

Only user routes (`app/api/users/route.ts`, `app/api/users/[id]/route.ts`) wrap `request.json()` in try-catch. Should be standardized across all routes.

### M2. Deposit `remainingOriginal` can go negative in theory

**File:** `lib/deposit-deduction-service.ts` (line 23)
Uses `{ decrement: deductAmount }` which is a Prisma atomic operation. If two concurrent requests deduct from the same deposit, both might pass the `remaining.lessThan(deductAmount)` check before either updates. The database should have a CHECK constraint `remainingOriginal >= 0` to prevent this.

**Fix:** Add to schema or migration:
```sql
ALTER TABLE "Deposit" ADD CONSTRAINT "deposit_remaining_non_negative" CHECK ("remainingOriginal" >= 0);
```

### M3. `partyModules()` helper duplicated in 3 files

**Files:** `app/api/parties/route.ts`, `app/api/parties/[id]/route.ts`, `app/api/parties/[id]/deposits/route.ts`

Extract to shared module in `lib/api-helpers.ts`.

### M4. Cashflow report loads all transactions into memory

**File:** `app/api/cashflow-report/route.ts` (line 49)
No pagination — fetches all transactions in a date range. For large businesses with months of data, this could OOM.

### M5. Missing `isActive` filter on deposit queries

Deposits don't have an `isActive` field per schema, which means deleted parties' deposits are still fetchable and usable. If a party is soft-deleted, their deposits remain available for deduction. Consider whether this is intentional.

### M6. User list count includes inactive users

**File:** `app/api/users/route.ts` (line 46)
`prisma.user.count()` has no `where` filter, so pagination metadata includes inactive users. The `findMany` also returns inactive users (by design for admin). Consistent, but the count should match the query's where clause.

### M7. Standalone transaction paymentType defaults to "PAYMENT" in validation schema

**File:** `lib/validation-schemas.ts` (line 104)
The `createStandaloneTransactionSchema` requires `paymentType: z.enum(["PAYMENT", "REFUND"])`. This is correct but the TransactionForm defaults to "PAYMENT" without explicit user choice since the field isn't in the form. It's always sent as the `paymentType` field in the form state. This appears to be set correctly.

---

## Positive Observations

1. **Consistent auth pattern** — Every single API route calls `withAuth()` + `checkAccess()`. No unauthenticated endpoints.
2. **Decimal.js everywhere** — All monetary arithmetic uses Decimal.js on both server and client. No floating-point operations.
3. **Atomic operations** — All multi-step mutations use `prisma.$transaction()`. Deposit deduction + status recalc + audit log are always atomic.
4. **Audit trail** — Every CREATE/UPDATE/DELETE has `createAuditLog()` inside the transaction.
5. **Clean RBAC matrix** — Permission matrix is centralized, readable, and correctly checked for both identity and permission.
6. **Soft delete** — Parties, business units, currencies, expense types, and users use `isActive` pattern with consistent filtering.
7. **Vietnamese UI** — All user-facing labels are in Vietnamese.
8. **Prisma schema** — Good indexing strategy on frequently queried columns.
9. **Input validation** — Zod schemas on all write endpoints with proper error formatting.

---

## Recommended Actions (Priority Order)

1. **[CRITICAL]** Fix `PaymentForm` to include `type` field derived from order type
2. **[CRITICAL]** Fix `TransactionForm` deposit endpoint — create `/api/business-units/[id]/deposits` route or restructure form
3. **[HIGH]** Add DB CHECK constraint on `Deposit.remainingOriginal >= 0` for race condition safety
4. **[HIGH]** Allowlist `sortBy` parameter in `parsePagination`
5. **[HIGH]** Consider reducing JWT maxAge or implementing role refresh
6. **[MEDIUM]** Standardize `request.json()` error handling across all routes
7. **[MEDIUM]** Extract duplicated `partyModules()` helper
8. **[LOW]** Add pagination to cashflow report for large date ranges

---

## Unresolved Questions

1. Is overpayment (netPaid > orderAmount) an expected business scenario? Current status calculator marks it as PAID.
2. Should deposits of soft-deleted parties remain usable?
3. Should the sidebar nav items be filtered by the user's actual RBAC permissions beyond just admin/non-admin?

---

**Status:** DONE_WITH_CONCERNS
**Summary:** Codebase is well-architected with strong security and data integrity patterns. Two critical functional bugs (missing `type` field in PaymentForm, nonexistent deposit endpoint in TransactionForm) will block core payment flows in production.
**Concerns:** The two critical bugs mean order payment creation and standalone deposit-based transactions are non-functional from the UI.
