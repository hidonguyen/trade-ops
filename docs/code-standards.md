# Code Standards – Trade Ops
## Implementation Guidelines & Conventions

**Status:** Standards Definition
**Last Updated:** 2026-04-02
**Version:** 1.0

---

## Overview

This document defines coding conventions, architectural patterns, and review checklist for Trade Ops development. All code MUST follow these standards before merge.

---

## File Naming & Organization

### TypeScript/JavaScript Files

**Convention:** Kebab-case for all `.ts`, `.tsx`, `.js`, `.jsx` files with descriptive self-documenting names.

**Examples:**
```
✅ lib/auth.ts
✅ lib/api-helpers.ts
✅ lib/audit-logger.ts
✅ lib/excel-export-service.ts
✅ components/party-form.tsx
✅ components/order-status-badge.tsx
✅ app/api/orders/route.ts
✅ app/api/transactions/[id]/route.ts
✅ types/index.ts (exception: single exports file)
```

**Anti-patterns:**
```
❌ lib/Auth.ts (PascalCase)
❌ lib/helpers.ts (too generic, no purpose)
❌ lib/index.ts (use module path instead)
❌ lib/util.ts (vague)
```

### File Size Management

**Rule:** Keep individual code files ≤ 200 lines of code (LOC) for optimal context management.

**Checklist:**
- Count LOC: `wc -l src/file.ts`
- If approaching 200 → plan split before adding more
- Exception: configuration files (e.g., `next.config.js`), docker-compose files

**Splitting Strategy:**
- **Service layer** (lib/): Split by domain (auth.ts, audit.ts, excel.ts)
- **Components**: Extract smaller UI sub-components into separate files
- **Routes**: Group related endpoints in nested `/api/{domain}/` directories
- **Types**: Keep in `types/index.ts` or split to `types/{domain}.ts`

**Example refactor:**
```
Before:
  lib/transaction-service.ts (350 LOC)
    ├─ createTransaction()
    ├─ updateTransaction()
    ├─ recalculateOrderStatus()
    ├─ deductDeposit()
    └─ exportToExcel()

After:
  lib/transaction-service.ts (80 LOC)
    ├─ createTransaction()
    ├─ updateTransaction()

  lib/order-status-calculator.ts (60 LOC)
    └─ recalculateOrderStatus()

  lib/deposit-deduction-service.ts (70 LOC)
    └─ deductDeposit()

  lib/excel-export-service.ts (120 LOC)
    └─ exportTransactionsToExcel()
```

---

## TypeScript Conventions

### Type Safety

**Rule:** No implicit `any`. Always specify types.

```typescript
// ✅ Good
async function getOrder(id: string): Promise<Order | null> {
  return await prisma.order.findUnique({ where: { id } });
}

const amounts: Decimal[] = [];
const config: Record<string, string> = {};

// ❌ Bad
async function getOrder(id: any) { // implicit any return
  return await prisma.order.findUnique({ where: { id } });
}

const amounts = [];  // any[]
```

### Enums & Literals

**Rule:** Use TypeScript enums or const unions for fixed sets. Align with Prisma schema.

```typescript
// ✅ Good – enum approach
enum OrderStatus {
  UNPAID = 'UNPAID',
  PARTIAL_PAID = 'PARTIAL_PAID',
  PAID = 'PAID'
}

// ✅ Alternative – const union (modern TypeScript)
const OrderStatus = {
  UNPAID: 'UNPAID',
  PARTIAL_PAID: 'PARTIAL_PAID',
  PAID: 'PAID'
} as const;

type OrderStatus = typeof OrderStatus[keyof typeof OrderStatus];

// ❌ Bad – string literals scattered
if (order.status === 'unpaid') { }  // inconsistent case
if (order.status === 'PARTIAL_PAID') { }
```

### Interface vs Type

**Rule:** Use `interface` for objects, `type` for unions/primitives.

```typescript
// ✅ Good
interface Party {
  id: string;
  name: string;
  email: string;
}

type OrderStatus = 'UNPAID' | 'PAID' | 'PARTIAL_PAID';
type PaymentMethod = 'BANK' | 'DEPOSIT';

// ❌ Avoid
type Party = {
  id: string;
  name: string;
};
```

---

## Money Handling (Decimal.js)

### THE CARDINAL RULE

**NEVER use `number` or `float` for monetary values. ALWAYS use Decimal.js or Prisma Decimal type.**

### Backend (Node.js)

```typescript
import Decimal from 'decimal.js';

// ✅ Correct
const amount = new Decimal('1000.50');
const rate = new Decimal('23.5');
const result = amount.times(rate); // Decimal

// Store in DB
await prisma.order.create({
  data: {
    amountOriginal: new Decimal('1000.50'),
    // Prisma handles Decimal → JSON serialization
  }
});

// Retrieve and use
const order = await prisma.order.findUnique({ where: { id } });
const paid = new Decimal(order.paidAmount); // Convert back from DB
const remaining = order.amountOriginal.minus(paid);

// ❌ Wrong
const amount = 1000.50;  // number (floating point errors)
const result = 1000.50 + 23.5;  // 1024.0000000000002 !!
```

### Frontend (React)

```typescript
import Decimal from 'decimal.js';

// ✅ Correct
const handleAmountChange = (amountOriginal: string, exchangeRate: string) => {
  const amount = new Decimal(amountOriginal);
  const rate = new Decimal(exchangeRate);
  const amountVnd = amount.times(rate).toDecimalPlaces(4);
  
  setFormData({
    amountOriginal,
    amountVnd: amountVnd.toString(),
    exchangeRate,
  });
};

// Send to API
const payload = {
  amountOriginal: formData.amountOriginal,
  amountVnd: formData.amountVnd,      // Pre-computed by client
  exchangeRate: formData.exchangeRate // Rate used by client
};

// ❌ Wrong
const amountVnd = parseFloat(amountOriginal) * parseFloat(exchangeRate); // float
```

### Database Schema (Prisma)

```prisma
// ✅ Correct – all money fields as Decimal
model Order {
  id        String  @id @default(uuid(7))
  
  amountOriginal  Decimal @db.Decimal(18, 4)  // 18 digits, 4 decimals
  paidAmount      Decimal @db.Decimal(18, 4)
  refundedAmount  Decimal @db.Decimal(18, 4)
}

model Transaction {
  amountOriginal  Decimal @db.Decimal(18, 4)
  amountVnd       Decimal @db.Decimal(18, 4)
  exchangeRate    Decimal @db.Decimal(18, 8)  // More precision for rates
}

// ❌ Wrong
model Order {
  amountOriginal Float      // floating point precision loss
  amountOriginal BigInt     // no decimals (integer only)
}
```

---

## API Response Format

### Standard JSON Structure

All API routes MUST return this format:

```typescript
// Success
{
  "success": true,
  "data": { /* entity or array */ }
}

// Validation error (400)
{
  "success": false,
  "message": "Validation failed",
  "errors": {
    "email": ["Invalid format"],
    "amount": ["Must be > 0"]
  }
}

// Authorization error (403)
{
  "success": false,
  "message": "Access denied"
}

// Server error (500)
{
  "success": false,
  "message": "Internal server error"
}
```

### Helper Function

```typescript
// lib/api-helpers.ts

export function apiResponse<T>(
  success: boolean,
  data?: T,
  message?: string,
  errors?: Record<string, string[]>
) {
  return {
    success,
    ...(data !== undefined && { data }),
    ...(message && { message }),
    ...(errors && { errors })
  };
}

// Usage
return Response.json(
  apiResponse(true, orders),
  { status: 200 }
);

return Response.json(
  apiResponse(false, undefined, 'Not found'),
  { status: 404 }
);
```

---

## Error Handling

### Try-Catch Pattern

```typescript
// ✅ Good
export async function getOrder(id: string) {
  try {
    const order = await prisma.order.findUnique({ where: { id } });
    if (!order) {
      return { success: false, message: 'Order not found', status: 404 };
    }
    return { success: true, data: order, status: 200 };
  } catch (error) {
    console.error('Error fetching order:', error);
    return { 
      success: false, 
      message: 'Internal server error', 
      status: 500 
    };
  }
}

// ❌ Bad
async function getOrder(id: string) {
  const order = await prisma.order.findUnique({ where: { id } });
  return order;  // Silent null, unhandled errors
}
```

### Validation with Zod

```typescript
// ✅ Good
import { z } from 'zod';

const createOrderSchema = z.object({
  partyId: z.string().uuid(),
  amountOriginal: z.string().refine(val => {
    try {
      new Decimal(val);
      return true;
    } catch {
      return false;
    }
  }, 'Invalid decimal format'),
  currencyId: z.string().uuid()
});

export async function createOrder(req: Request) {
  const body = await req.json();
  
  const validation = createOrderSchema.safeParse(body);
  if (!validation.success) {
    return Response.json(
      apiResponse(false, undefined, 'Validation failed', 
        validation.error.flatten().fieldErrors),
      { status: 400 }
    );
  }
  
  const { partyId, amountOriginal, currencyId } = validation.data;
  // Use validated data...
}
```

---

## Prisma Patterns

### Transaction Atomicity

**Rule:** Multi-step operations MUST use `prisma.$transaction()`.

```typescript
// ✅ Correct – atomic transaction
await prisma.$transaction(async (tx: any) => {
  // 1. Create transaction
  const transaction = await tx.transaction.create({
    data: {
      orderId,
      type: 'SALE_PAYMENT',
      amountOriginal: new Decimal(payload.amountOriginal),
      amountVnd: new Decimal(payload.amountVnd),
      // ...
    }
  });
  
  // 2. Decrement deposit
  if (payload.paymentMethod === 'DEPOSIT') {
    await tx.deposit.update({
      where: { id: depositId },
      data: {
        remainingOriginal: {
          decrement: new Decimal(payload.amountOriginal)
        }
      }
    });
  }
  
  // 3. Recalculate order status
  const order = await tx.order.findUnique({ where: { id: orderId } });
  // ... calculate status logic ...
  await tx.order.update({
    where: { id: orderId },
    data: { status: 'PARTIAL_PAID' }
  });
  
  // 4. Log audit entry
  await tx.auditLog.create({
    data: {
      userId,
      action: 'CREATE',
      model: 'Transaction',
      recordId: transaction.id,
      // ...
    }
  });
  
  return transaction;
});
```

### Query Optimization

```typescript
// ✅ Good – selective include
const order = await prisma.order.findUnique({
  where: { id },
  include: {
    party: true,
    transactions: true,  // Only if needed
    // Skip: deposits, depositUsages if not required
  }
});

// ❌ Avoid – greedy include
const order = await prisma.order.findUnique({
  where: { id },
  include: {
    party: {
      include: { deposits: true }  // N+1 risk
    },
    transactions: {
      include: { /* ... nested includes ... */ }
    }
  }
});
```

### Unique Constraints & Indexes

```prisma
// ✅ Good – indexed for common queries
model Order {
  id    String  @id @default(uuid(7))
  
  businessUnitId String
  partyId        String
  status         String
  transactionDate DateTime
  
  @@index([businessUnitId, status])
  @@index([partyId, transactionDate])
}

// ✅ Good – unique business constraints
model UserRoleAssignment {
  userId String
  role   String
  
  @@unique([userId, role])
}
```

---

## Route Handler Pattern

All Route Handlers (`/api/...`) follow this structure:

```typescript
// app/api/orders/route.ts

import { withAuth } from '@/lib/auth';
import { checkAccess } from '@/lib/api-helpers';
import { apiResponse } from '@/lib/api-helpers';
import { createOrderSchema } from '@/lib/schemas';

// GET /api/orders
export async function GET(request: Request) {
  const session = await withAuth(request);
  if (!session) {
    return Response.json(
      apiResponse(false, undefined, 'Unauthorized'),
      { status: 401 }
    );
  }
  
  // RBAC is per Business Unit: resolve the TARGET businessUnitId, then check.
  // checkAccess(roles, action, module, businessUnitId) — pass null for global ops.
  const businessUnitId = new URL(request.url).searchParams.get('businessUnitId');
  const access = checkAccess(session.user.roles, 'GET', 'SALE', businessUnitId);
  if (!access) {
    return Response.json(
      apiResponse(false, undefined, 'Access denied'),
      { status: 403 }
    );
  }
  
  try {
    const orders = await prisma.order.findMany({
      where: { businessUnitId }
    });
    
    return Response.json(apiResponse(true, orders));
  } catch (error) {
    console.error('Error fetching orders:', error);
    return Response.json(
      apiResponse(false, undefined, 'Internal server error'),
      { status: 500 }
    );
  }
}

// POST /api/orders
export async function POST(request: Request) {
  const session = await withAuth(request);
  if (!session) {
    return Response.json(
      apiResponse(false, undefined, 'Unauthorized'),
      { status: 401 }
    );
  }
  
  const body = await request.json();
  const validation = createOrderSchema.safeParse(body);
  
  if (!validation.success) {
    return Response.json(
      apiResponse(
        false,
        undefined,
        'Validation failed',
        validation.error.flatten().fieldErrors
      ),
      { status: 400 }
    );
  }
  
  // RBAC check uses the target BU from the validated payload.
  const access = checkAccess(
    session.user.roles, 'CREATE', 'SALE', validation.data.businessUnitId
  );
  if (!access) {
    return Response.json(
      apiResponse(false, undefined, 'Access denied'),
      { status: 403 }
    );
  }
  
  try {
    const order = await prisma.$transaction(async (tx: any) => {
      const created = await tx.order.create({
        data: { ...validation.data }
      });
      
      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: 'CREATE',
          model: 'Order',
          recordId: created.id,
          timestamp: new Date()
        }
      });
      
      return created;
    });
    
    return Response.json(apiResponse(true, order), { status: 201 });
  } catch (error) {
    console.error('Error creating order:', error);
    return Response.json(
      apiResponse(false, undefined, 'Internal server error'),
      { status: 500 }
    );
  }
}
```

---

## Component Patterns (React/TypeScript)

### Functional Components with TypeScript

```typescript
// ✅ Good
interface OrderFormProps {
  initialData?: Order;
  onSubmit: (data: CreateOrderInput) => Promise<void>;
}

export const OrderForm: React.FC<OrderFormProps> = ({
  initialData,
  onSubmit
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
      // Validate and submit...
      await onSubmit(formData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <form onSubmit={handleSubmit}>
      {/* Form fields */}
    </form>
  );
};
```

### Custom Hooks

```typescript
// hooks/use-orders.ts

interface UseOrdersOptions {
  businessUnitId: string;
  page?: number;
  limit?: number;
}

export function useOrders({
  businessUnitId,
  page = 1,
  limit = 50
}: UseOrdersOptions) {
  const [data, setData] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const res = await fetch(
          `/api/orders?businessUnitId=${businessUnitId}&page=${page}&limit=${limit}`
        );
        const result = await res.json();
        
        if (!result.success) {
          throw new Error(result.message);
        }
        
        setData(result.data);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
      } finally {
        setLoading(false);
      }
    };
    
    fetchOrders();
  }, [businessUnitId, page, limit]);
  
  return { data, loading, error };
}
```

---

## Commit Message Format

**Rule:** Use conventional commits; be concise and descriptive.

```
Format: <type>: <subject>

feat: add order status auto-recalculation
fix: prevent duplicate deposit deduction on retry
docs: add API endpoint documentation
refactor: split transaction service into two modules
test: add tests for cashflow report calculation
chore: update Prisma to 5.10.1

✅ Good examples:
  feat: implement RBAC middleware
  fix: handle null exchange rate in amountVnd calculation
  refactor: extract deposit deduction logic to service

❌ Bad examples:
  update stuff
  fix bugs
  AI: implement feature
  add code
```

---

## Code Review Checklist

Before submitting PR, verify:

- [ ] TypeScript strict mode: no implicit `any`
- [ ] All monetary values use Decimal, not number
- [ ] API responses follow standard format
- [ ] Error handling: try-catch or validation
- [ ] Prisma transactions for multi-step ops
- [ ] Zod validation on request body
- [ ] RBAC check: `checkAccess()` call
- [ ] Audit log on CREATE/UPDATE/DELETE
- [ ] No hardcoded credentials or secrets
- [ ] File size < 200 LOC (or justification)
- [ ] Kebab-case file names
- [ ] Comments on complex logic
- [ ] Tests included for new features

---

## Related Documentation

- `/docs/system-architecture.md` – Data model, API design
- `/docs/project-overview-pdr.md` – Functional requirements
- `/docs/codebase-summary.md` – Directory organization

