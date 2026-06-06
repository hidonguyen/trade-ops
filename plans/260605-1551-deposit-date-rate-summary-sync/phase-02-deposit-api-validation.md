---
phase: 2
title: Deposit API & Validation
status: completed
priority: P1
effort: 2h
dependencies:
  - 1
---

# Phase 2: Deposit API & Validation

## Overview

Accept and persist `depositDate` and `exchangeRate` in the deposit create (POST) and update (PATCH) routes, with zod validation. Default `depositDate` to "now" when omitted on create; default `exchangeRate` to "1".

## Requirements

- Functional:
  - POST creates a deposit with `depositDate` (defaults to now if absent) and `exchangeRate` (defaults to "1").
  - PATCH can update `depositDate` and `exchangeRate` (both optional, always editable — NOT subject to the usage-lock that guards currency/BU/amount).
  - Audit log captures the new fields on create/update.
- Non-functional: reuse existing validators; keep `Decimal(18,8)` semantics; no behavior change to balance fields.

## Architecture

- Reuse `dateField` (`lib/validation-schemas.ts:43`) for `depositDate`. For `exchangeRate`, do **not** reuse the unbounded `decimalString` — it only checks `isFinite() && > 0` (`lib/validation-schemas.ts:7-17`) and would accept `"1e20"` (→ Prisma `Decimal(18,8)` overflow → opaque 500) or `"0.000000001"` (→ Postgres rounds to `0` → report VND = 0, the exact bug we are fixing). Add a **bounded** rate validator:
  ```ts
  // Positive FX rate bounded to Decimal(18,8): max 10 integer digits, max 8 fractional.
  export const exchangeRateString = z.string().refine((val) => {
    try {
      const d = new Decimal(val);
      return d.isFinite() && d.greaterThan(0) && d.lessThanOrEqualTo("9999999999") && d.decimalPlaces() <= 8;
    } catch { return false; }
  }, { message: "Tỉ giá không hợp lệ" });
  ```
  (Do not blindly copy `Order.exchangeRate`'s unbounded validator — that field shares the same latent bug; this field now drives report math, so bound it.)
- **Edit policy (user-confirmed):** `depositDate` and `exchangeRate` are metadata that do NOT participate in the usage-lock (`assertCanEditMetadata`) freezing currency/BU once `DepositUsage` rows exist. They stay editable regardless of usages. Rationale: a deposit's rate/date only affect the **report display** (deposits hold no VND ledger balance; usages are in original currency), and `amountOriginal` is already editable post-usage — so allowing a rate/date typo fix is consistent and does not corrupt the ledger. (Red-team flagged that editing the rate of a consumed deposit restates that deposit's VND on past report renders; accepted as intended given it is display-only.)

## Related Code Files

- Modify: `lib/validation-schemas.ts` — `createDepositSchema` (~lines 159-164), `updateDepositSchema` (~lines 166-172)
- Modify: `app/api/parties/[id]/deposits/route.ts` — POST handler (lines 138-163): add fields to `tx.deposit.create` data + audit payload
- Modify: `app/api/parties/[id]/deposits/[depositId]/route.ts` — PATCH handler: extend destructure, "at least one field" guard, `updateData`, and audit snapshots (lines 84-165); DELETE handler audit snapshot (lines 241-254)

## Implementation Steps

1. **Validation** (`lib/validation-schemas.ts`):
   ```ts
   export const createDepositSchema = z.object({
     currencyId: z.string().uuid(),
     amountOriginal: decimalString,
     businessUnitId: z.string().uuid(),
     exchangeRate: exchangeRateString.default("1"),
     depositDate: dateField.optional(),   // route defaults to now() when absent
     notes: z.string().max(2000).optional().nullable(),
   });

   export const updateDepositSchema = z.object({
     currencyId: z.string().uuid().optional(),
     amountOriginal: decimalString.optional(),
     businessUnitId: z.string().uuid().optional(),
     exchangeRate: exchangeRateString.optional(),
     depositDate: dateField.optional(),
     notes: z.string().max(2000).optional().nullable(),
   });
   ```
2. **POST route** (`deposits/route.ts`, in `tx.deposit.create` data block ~line 140):
   - Add `exchangeRate: validation.data.exchangeRate,`
   - Add `depositDate: validation.data.depositDate ?? new Date(),`
   - **Audit the PERSISTED record, not `validation.data`** (current code logs `validation.data` at line 160). When the user omits `depositDate`, `validation.data.depositDate` is `undefined` while the row actually stores `new Date()` — logging `validation.data` would record no date. Build the audit payload from the created row instead, with deterministic serialization:
     ```ts
     await createAuditLog(tx, session.user.id!, "CREATE", "Deposit", created.id, {
       partyId, currencyId: created.currencyId, businessUnitId: created.businessUnitId,
       amountOriginal: created.amountOriginal.toString(),
       exchangeRate: created.exchangeRate.toString(),
       depositDate: created.depositDate.toISOString(),
       notes: created.notes,
     });
     ```
     (`created` is the `tx.deposit.create` return value — already in scope at line ~153.)
3. **PATCH route** (`deposits/[depositId]/route.ts`):
   - Destructure (line 84): add `exchangeRate`, `depositDate`.
   - "At least one field" guard (line 87): include `&& exchangeRate === undefined && depositDate === undefined`.
   - `updateData` (lines 130-142): `if (exchangeRate !== undefined) updateData.exchangeRate = exchangeRate;` and `if (depositDate !== undefined) updateData.depositDate = depositDate;`
   - Audit `incomingSnapshot` / `existingSnapshot` (lines 154-165): add both fields (existing → `existing.exchangeRate.toString()`, `existing.depositDate.toISOString()`). The `existing` deposit is fetched with `include` (no restrictive `select`) at lines 64-70, so `existing.depositDate`/`existing.exchangeRate` scalars are present — no fetch change needed.
   - **Do NOT** gate these two fields behind `assertCanEditMetadata` — only currency/BU/amount remain guarded (see Edit policy above; user-confirmed).
4. **DELETE route** (`deposits/[depositId]/route.ts:241-254`): the deletion audit snapshot enumerates fields explicitly and currently omits the new ones. Add `exchangeRate: existing.exchangeRate.toString()` and `depositDate: existing.depositDate.toISOString()` so a deleted deposit's VND contribution to past reports stays reconstructable.
5. Run `npm run type-check`. Manually smoke-test create + edit via the running app or `curl`, including an omitted-date create (verify audit shows the stored date) and an out-of-bounds rate (verify 400).

## Success Criteria

- [ ] POST persists `depositDate` (or now()) and `exchangeRate` (or "1")
- [ ] PATCH updates `depositDate` / `exchangeRate` even when the deposit has usages (not locked)
- [ ] `exchangeRateString` rejects non-positive, `> 1e10`, and `> 8`-decimal rates; malformed dates rejected
- [ ] Audit log records the **persisted** `depositDate`/`exchangeRate` on create (even when date omitted), update, AND delete
- [ ] `npm run type-check` passes

## Risk Assessment

- Risk: audit util receives a raw `Date` → mitigated by building audit payloads from the persisted row with explicit `.toISOString()` / `.toString()` (steps 2-4).
- Risk: PATCH "no fields" guard misses new fields → covered in step 3.
- Risk: unbounded rate overflows `Decimal(18,8)` or rounds to 0 → mitigated by `exchangeRateString` bound.

## Security Considerations

RBAC unchanged — new fields flow through the same `hasPartyAccess` checks. No new endpoints.

## Next Steps

Phases 3 (UI) and 4 (report) can proceed in parallel once this lands.
