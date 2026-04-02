# Phase 3: Order + Transaction APIs

## Context Links
- [System Architecture](../../docs/system-architecture.md) -- Order/Transaction models, status recalc, deposit deduction
- [Code Standards](../../docs/code-standards.md) -- Decimal.js patterns, Prisma $transaction
- [Wireframe: Orders List](../../docs/wireframes/02-orders-list.html)
- [Wireframe: Order Detail](../../docs/wireframes/03-order-detail.html)

## Overview
- **Priority:** P1
- **Status:** Complete
- **Effort:** 5h
- **Blocked by:** Phase 1
- **Blocks:** Phase 7
- **Parallel with:** Phases 2, 4, 5
- **Description:** Implement Order CRUD, Transaction CRUD (both order-linked and standalone), order status auto-recalculation, and atomic deposit deduction service.

## Key Insights
- Order status is derived: recalculated after every Transaction add/edit/delete
- Deposit deduction must be atomic: Transaction create + Deposit.remainingOriginal decrement + DepositUsage create
- `amountVnd` is sent by client, never computed by server
- Standalone transactions (RECEIPT/PAYMENT) have no orderId
- Order-linked transactions (SALE_PAYMENT/PURCHASE_PAYMENT) always have orderId
- SALE orders -> CUSTOMER dimension RBAC; PURCHASE orders -> SUPPLIER dimension RBAC
- Refund transactions reduce paidAmount -> may revert status to PARTIAL_PAID or UNPAID

## File Ownership (Exclusive)

```
app/api/orders/route.ts
app/api/orders/[id]/route.ts
app/api/orders/[id]/transactions/route.ts
app/api/orders/[id]/transactions/[txId]/route.ts
app/api/orders/[id]/report/route.ts
app/api/transactions/route.ts
app/api/transactions/[id]/route.ts
lib/order-status-calculator.ts
lib/deposit-deduction-service.ts
```

## Implementation Steps

### 1. Order Status Calculator (1h)
1. `lib/order-status-calculator.ts`
   - `recalculateOrderStatus(orderId: string, tx: PrismaTransactionClient): Promise<Order>`
   - Fetch all transactions for order
   - Sum PAYMENT type transactions -> paidAmount (Decimal)
   - Sum REFUND type transactions -> refundedAmount (Decimal)
   - Determine status:
     - netPaid = 0 -> UNPAID
     - 0 < netPaid < amountOriginal -> PARTIAL_PAID
     - netPaid >= amountOriginal -> PAID
     - refundedAmount > 0 && netPaid < amountOriginal -> PARTIAL_REFUNDED (if was PAID)
     - refundedAmount >= amountOriginal -> REFUNDED
   - Update order with { status, paidAmount, refundedAmount }
   - All arithmetic via Decimal.js

### 2. Deposit Deduction Service (1h)
1. `lib/deposit-deduction-service.ts`
   - `deductDeposit(depositId, amountOriginal, transactionId, tx): Promise<void>`
   - Validate: deposit exists, remainingOriginal >= amountOriginal
   - Decrement `deposit.remainingOriginal` by amountOriginal
   - Create DepositUsage record { depositId, transactionId, amountOriginal }
   - Throw if insufficient balance
   - Must run inside prisma.$transaction (receives tx client)

### 3. Order Routes (1.5h)
1. `app/api/orders/route.ts`
   - GET: List orders with filters (?type=SALE|PURCHASE, ?businessUnitId, ?status, ?partyId, pagination)
   - Include: party name, currency, transaction count
   - POST: Create order in $transaction { businessUnitId, partyId, type, amountOriginal, currencyId, orderDate, notes }
   - Set initial status=UNPAID, paidAmount=0, refundedAmount=0
   - RBAC: SALE->SALE dimension, PURCHASE->PURCHASE dimension
   - Audit log on create
2. `app/api/orders/[id]/route.ts`
   - GET: Order detail with transactions, deposit usages, party info
   - PATCH: Update order fields (only if no transactions exist, or only notes/date)
   - Audit log on update

### 4. Order Transaction Routes (1h)
1. `app/api/orders/[id]/transactions/route.ts`
   - GET: List transactions for this order
   - POST: Create transaction linked to order, in $transaction:
     a. Validate order exists
     b. Create transaction { orderId, type, paymentMethod, paymentType, amountOriginal, currencyId, amountVnd, exchangeRate, bankReference, transactionDate, notes }
     c. If paymentMethod=DEPOSIT: call deductDeposit()
     d. Call recalculateOrderStatus()
     e. Create audit log
2. `app/api/orders/[id]/transactions/[txId]/route.ts`
   - PATCH: Edit transaction (amount, date, notes) -> recalculate order status
   - DELETE: Remove transaction, if DEPOSIT: reverse deposit deduction (increment remainingOriginal, delete DepositUsage), recalculate status
   - All in $transaction

### 5. Order Report Route (0.25h)
1. `app/api/orders/[id]/report/route.ts`
   - GET: Order financial summary { amountOriginal, paidAmount, refundedAmount, remainingAmount, status, transactionCount }

### 6. Standalone Transaction Routes (0.25h)
1. `app/api/transactions/route.ts`
   - GET: List standalone transactions (type=RECEIPT|PAYMENT, no orderId), with filters + pagination
   - POST: Create standalone receipt/payment (no orderId)
   - RBAC: RECEIPT dimension for receipts, PAYMENT dimension for payments
2. `app/api/transactions/[id]/route.ts`
   - PATCH: Edit standalone transaction
   - DELETE: Remove standalone transaction (if DEPOSIT method: reverse deduction)

## Business Logic: Status Calculation

```
paidAmount = SUM(tx.amountOriginal WHERE paymentType=PAYMENT)
refundedAmount = SUM(tx.amountOriginal WHERE paymentType=REFUND)
netPaid = paidAmount - refundedAmount

if netPaid == 0 && refundedAmount == 0 -> UNPAID
if netPaid > 0 && netPaid < order.amountOriginal -> PARTIAL_PAID
if netPaid >= order.amountOriginal -> PAID
if refundedAmount > 0 && netPaid < order.amountOriginal && was PAID -> PARTIAL_REFUNDED
if netPaid <= 0 && refundedAmount > 0 -> REFUNDED
```

## Business Logic: Deposit Deduction (Atomic)

```
prisma.$transaction:
  1. Create Transaction (paymentMethod=DEPOSIT)
  2. Deposit.remainingOriginal -= amountOriginal
  3. Create DepositUsage { depositId, transactionId, amountOriginal }
  4. Recalculate order status (if order-linked)
  5. Audit log
```

## Todo Checklist

- [x] lib/order-status-calculator.ts with all status transitions
- [x] lib/deposit-deduction-service.ts with balance validation
- [x] Orders GET (list with filters + pagination)
- [x] Orders POST (create with initial status)
- [x] Orders GET [id] (detail with includes)
- [x] Orders PATCH [id] (update with constraints)
- [x] Order transactions GET / POST (with deposit deduction + status recalc)
- [x] Order transactions PATCH / DELETE (with reversal logic)
- [x] Order report GET [id] (financial summary)
- [x] Standalone transactions GET / POST
- [x] Standalone transactions PATCH / DELETE
- [x] All operations wrapped in prisma.$transaction where multi-step
- [x] Audit logs on all writes
- [x] RBAC enforced per order type (SALE vs PURCHASE)

## Success Criteria
1. Creating a transaction correctly recalculates order status
2. Deposit deduction is atomic: transaction + deposit update + usage record
3. Deleting a deposit-linked transaction reverses the deduction
4. Status transitions: UNPAID -> PARTIAL_PAID -> PAID -> PARTIAL_REFUNDED -> REFUNDED
5. amountVnd stored as-is from client, never computed
6. All Decimal arithmetic uses Decimal.js, zero float operations
7. Standalone transactions work without orderId

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Race condition on deposit deduction | Medium | High | Always use prisma.$transaction with serializable isolation |
| Status calc edge case (exact amount) | Medium | Medium | Use Decimal.greaterThanOrEqualTo, never == for money |
| Transaction delete without deposit reversal | Medium | High | Always check paymentMethod; reverse in same $transaction |
| Orphaned DepositUsage on partial failure | Low | High | All steps in single $transaction -- atomic rollback |

## Security Considerations
- Order type determines RBAC dimension (SALE vs PURCHASE)
- Transaction creation validates orderId belongs to correct businessUnit
- Deposit deduction validates deposit belongs to same party/businessUnit
- No direct Decimal construction from user input without zod validation first
