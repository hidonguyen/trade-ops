# Phase 02 — Validation schemas

## Overview
- Priority: High
- Status: pending
- Depends on: Phase 01

Update zod schemas so `depositId` is optional when `paymentMethod=DEPOSIT` AND `paymentType=REFUND` (auto-create path), and require `partyId` on standalone refund auto-create.

## Schema changes (`lib/validation-schemas.ts`)

### `createOrderTransactionSchema`

Current: `depositId: z.string().uuid().optional()` — already optional.

Add refinement:

```ts
.refine(
  (d) => {
    // For DEPOSIT method:
    if (d.paymentMethod !== "DEPOSIT") return true;
    if (d.paymentType === "PAYMENT") return Boolean(d.depositId);
    // REFUND + DEPOSIT: depositId optional (auto-create fallback)
    return true;
  },
  { message: "depositId is required for PAYMENT via DEPOSIT", path: ["depositId"] }
)
```

### `createStandaloneTransactionSchema`

Add optional `partyId` field + conditional refinement:

```ts
partyId: z.string().uuid().optional(),

// Refinement: REFUND + DEPOSIT without depositId requires partyId for auto-create
.refine(
  (d) => {
    if (d.paymentMethod !== "DEPOSIT") return true;
    if (d.paymentType === "PAYMENT") return Boolean(d.depositId);
    // REFUND + DEPOSIT
    if (d.depositId) return true;
    return Boolean(d.partyId);
  },
  { message: "partyId required to auto-create deposit for refund", path: ["partyId"] }
)
```

**Note:** `partyId` is NOT persisted on `Transaction` itself — only used server-side to wire the auto-created deposit. Drop from DB write; keep in validation layer.

## Files

- Modify: `lib/validation-schemas.ts`

## Steps

1. Add refinements to both schemas.
2. For standalone schema: add `partyId` field (optional).
3. Standalone POST handler: strip `partyId` from data spread into prisma create.
4. Type-check.

## Todo

- [ ] Order-tx schema refinement: PAYMENT needs depositId, REFUND doesn't
- [ ] Standalone schema: optional `partyId` + refinement for auto-create
- [ ] Standalone POST: do not persist `partyId` on Transaction row
- [ ] Type-check passes

## Success Criteria

- PAYMENT + DEPOSIT with no `depositId` → 400 validation error.
- REFUND + DEPOSIT with no `depositId` + no `partyId` (standalone) → 400 validation error.
- REFUND + DEPOSIT with `partyId` only → 201, new deposit created.
- REFUND + DEPOSIT with `depositId` → 201, existing deposit credited.

## Risks

- Refinement ordering matters (runs after base schema parse). Zod handles fine.
