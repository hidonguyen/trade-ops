# Code Review — Batch 6 Phases (Accountant Role + UI Refinements)

**Status:** DONE_WITH_CONCERNS
**Summary:** No critical/security bugs found. Phase 06 (multi-combobox) is solid. Two latent UI bugs in Phase 03, one validation regression in audit-logs, and Phase 04 DRY incomplete.

---

## Critical
_None._

## High Priority

### 1. Phase 03 — `initialData` ref instability can wipe user's type selection
**File:** `app/(dashboard)/parties/new/page.tsx:46` + `components/party-form.tsx:48-50`

`<PartyForm initialData={defaultType ? { type: defaultType } : undefined} />` creates a **new object reference on every parent render**. `party-form.tsx` syncs via:
```ts
useEffect(() => { if (initialData) setForm((f) => ({ ...f, ...initialData })); }, [initialData]);
```
Any parent re-render after user changes the type will overwrite their selection back to `defaultType`. Today the parent has no state, so this is dormant — but the bomb is armed. The effect was designed for the edit mode case where data loads later; here it's wrong.

**Fix options (pick one):**
- Memoize: `const initial = useMemo(() => defaultType ? { type: defaultType } : undefined, [defaultType])`.
- Or guard the effect in `party-form.tsx`: only run once in create mode (`if (mode === "create") return;`).
- Or accept `defaultType` separately from `initialData` in the form.

### 2. Audit-logs — Zod removal lost `action` enum validation
**File:** `app/api/audit-logs/route.ts:38`

```ts
const actions = parseCsvParam(searchParams, "action") as Array<"CREATE" | "UPDATE" | "DELETE">;
```
Previously Zod constrained `action` to the enum and returned 400 for garbage. Now any string passes to Prisma. Since `AuditLog.action` is a `String` (not Prisma enum, confirmed in schema.prisma:36), invalid values won't error — they'll silently return zero rows. The TS cast is a lie. Not a security/data issue, but a contract regression.

**Fix:** validate the parsed array against the literal set before passing to Prisma, or filter to known values:
```ts
const valid = new Set(["CREATE","UPDATE","DELETE"]);
const actions = parseCsvParam(...).filter(a => valid.has(a)) as ("CREATE"|"UPDATE"|"DELETE")[];
```

## Medium Priority

### 3. Phase 04 — DRY incomplete: 4 sites still hardcode payment-method options
The plan claimed the new `lib/payment-method-labels.ts` replaces duplicate maps, but these 4 sites still inline `{value:"BANK",label:"Ngân hàng"}, {value:"DEPOSIT",label:"Cọc"}, {value:"CASH",label:"Tiền mặt"}` form options:

- `app/(dashboard)/transactions/page.tsx:50-52` (filter options)
- `components/payment-form.tsx:333-335` (combobox options)
- `components/transaction-form.tsx:279-281` (combobox options)
- `app/(dashboard)/orders/[id]/order-transactions-table.tsx:55-59` (PAYMENT_METHOD_LABEL local map)

The shared module exports `PAYMENT_METHOD_OPTIONS` and `PAYMENT_METHOD_LABELS` exactly for this purpose. Replace them — next time someone adds a method (e.g. "CHEQUE"), this exact bug pattern recurs.

### 4. `bank-fees/route.ts` — variable shadowing of `currencyIds`
**File:** `app/api/reports/bank-fees/route.ts:39 vs :91`

Outer `currencyIds = parseCsvParam(...)` shadowed by inner `const currencyIds = aggregates.map(a => a.currencyId)` in the same function (different block scope). Legal but confusing — the outer name represents "user filter input"; the inner is "currencies present in aggregates". Rename the inner to `aggregateCurrencyIds`.

### 5. Parties list — "Tạo mới" defaults to CUSTOMER on combined view
**File:** `app/(dashboard)/parties/page.tsx:35,121`

```ts
const partyModule = urlType === "SUPPLIER" ? "SUPPLIER" : "CUSTOMER";
```
If `urlType` is missing (combined `/parties` view), the create button still routes to `?type=CUSTOMER`. Plan said "carries `?type=` from current filter" — silent default to CUSTOMER may not be intended. Either accept and document, or omit the param when no filter.

## Low Priority

### 6. `multi-combobox.tsx` — 228 LOC, slightly over guideline
At 228 lines it's modest overflow of the 200-line file limit and is logically cohesive (one component, internal helpers). Splitting would harm readability. **Keep as-is.**

### 7. `multi-combobox.tsx:30` — diacritic strip regex looks busted in this view
```ts
.replace(/[̀-ͯ]/g, "")
```
The character class is the combining diacritical marks range (U+0300–U+036F) — looks fine if the file encoding preserved the combining range delimiters. Verify by testing search "nguyen" → "Nguyễn". If broken, replace with explicit unicode escapes: `/[̀-ͯ]/g`.

### 8. Filter-bar CSV join — no `encodeURIComponent` worry
IDs and uppercase enums never contain commas; CSV split is safe. `URLSearchParams` handles encoding for the param value. No injection vector.

## Phase Verification

| Phase | Verdict | Notes |
|-------|---------|-------|
| 01 RBAC | OK | No code uses ACCOUNTANT_CASHFLOW write on payments. Seed/tests clean. |
| 02 Order sort | OK | `searchParams.get("sortBy")` correctly distinguishes explicit vs default. |
| 03 Party prefill | BUG #1 | initialData ref unstable. |
| 04 CASH payment | OK + DRY #3 | Zod, types, Prisma column updated. Inline label dupes remain. |
| 05 Date-picker dropdowns | OK | captionLayout="dropdown", startMonth/endMonth set. |
| 06 Multi-combobox | OK | Backward compat verified: single-value `?partyId=abc` → `["abc"]` → `{ in:["abc"] }`. Excel exports pass raw filter strings (CSV) — server splits, works. |

## Security
- No SQL injection: all CSV values flow into Prisma `{ in: [...] }`, parameterized.
- No new auth bypass: every multi-select endpoint retains the same `checkAccess` + `businessUnitId` scoping.
- No PII leakage in new code.

## Positive
- `parseCsvParam` is a clean, tight helper — good consolidation.
- BU scope enforcement preserved in all touched routes.
- Cache invalidation tags untouched and correct.
- Phase 06 multi-combobox a11y attributes (`role="listbox"`, `aria-multiselectable`, `aria-selected`) properly set.

## Recommended Actions (priority order)
1. Fix Phase 03 `initialData` instability (memoize or guard effect).
2. Restore `action` enum validation in audit-logs route.
3. Replace 4 hardcoded payment-method option arrays with shared `PAYMENT_METHOD_OPTIONS`.
4. Rename shadowed `currencyIds` in bank-fees route.
5. Decide intent on combined `/parties` "Tạo mới" default type.

## Unresolved Questions
- Is the "combined" `/parties` view (no `?type=`) even reachable from the sidebar? If not, #5 is moot.
- Should `paymentMethod` become a Prisma enum (vs free-form String) now that CASH is added? Free-form may invite typos like "Cash" or "BANK ".
