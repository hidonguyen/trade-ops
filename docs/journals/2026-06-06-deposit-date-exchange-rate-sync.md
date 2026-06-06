# Deposit Date + Exchange Rate: Sync & Summary Report

**Date**: 2026-06-06 14:30
**Severity**: High
**Component**: Deposits (API + Summary Report Export)
**Status**: Resolved

## What Happened

Shipped deposit `depositDate` (user-editable, defaults to today) + `exchangeRate` (Decimal(18,8), defaults to 1) with synced calculation across summary report table and Excel export. Deposits now filterable/sortable by date. VND conversion displayed: `amount × exchangeRate`. Red-team review caught 2 critical data bugs before implementation.

## Technical Substance

### 1. UTC Date-Range Boundary Bug (Critical)

Summary report + export routes built their date window incorrectly:
- `new Date(dateFrom)` → UTC midnight ✓
- `toDate.setHours(23, 59, 59, 999)` → **SERVER-LOCAL time** ✗

Deposits stored as UTC midnight via `dateField` transform (`new Date("YYYY-MM-DD")`). On UTC+7 server:
- `toDate = 23:59:59 local = 16:59:59 UTC`
- Deposits at evening (after 16:59:59 UTC) silently dropped from period

**Fix**: Normalized both routes to explicit ISO date boundaries: `${date.slice(0,10)}T00:00:00.000Z` / `T23:59:59.999Z`. Orders list route already had correct UTC pattern — report routes had drifted.

**Lesson**: Date-only field + server-local boundary = silent off-by-one on non-UTC TZ. Must audit all date windows when refactoring from timestamp to date-only field.

### 2. NOT NULL Column with No DB Default = Landmine (Critical)

`depositDate` required, no default. Refund auto-create path (`createDepositFromRefund` called via `applyDepositOperation` from 4 transaction routes) used `tx: any`, so it compiled but was **runtime-broken every refund**:
```
applyDepositOperation(tx: any, ...) { tx.create(...) } // tx typed as any—field validation skipped
```

Refund routes would throw on `amount` not null when creating auto-deposit.

**Fix**: Threaded `depositDate` + `exchangeRate` through refund → `createDepositFromRefund` → all 4 callers. Auto-deposit inherits refund's date + rate (also correctness win: report VND now matches the refund's rate).

**Lesson**: `tx: any` hides required-field regressions. Grep every `.create()` site when adding required columns.

### 3. Audit Logged Request, Not Row (Correctness)

Audit originally logged `validation.data.depositDate`. When user omits date:
- Row stores `now()` via DB default
- `validation.data.depositDate = undefined`
- Audit record never captures actual stored date

**Fix**: Log the created row with explicit `.toISOString()` / `.toString()`.

### 4. Rate Validator Unbounded → 500s (Silent Overflow)

Reused `decimalString` validator accepts `1e20` (overflows Decimal(18,8) → Postgres 500 error) or `0.000000001` (rounds to 0 → report shows `amount × 0 = 0 VND`, the exact bug the feature fixes).

**Fix**: `exchangeRateString` validates ≤10 integer digits, ≤8 decimals, positive.

### 5. VND Scope (Bank Fees Excluded)

Plan initially populated `t.amountVnd` for all report rows. Bank-fee rows use `bankFeeOriginal` (not `amountOriginal`), so blanket conversion was wrong.

**Fix**: VND rendered only for deposit rows; non-deposits show "—".

## Files Changed

**New:**
- `lib/validation-schemas.ts` — `exchangeRateString` validator
- Tests: 37 unit tests covering date boundaries, rate overflow, refund threading, audit logging

**Modified:**
- `prisma/schema.prisma` — Deposit: add `depositDate DateTime`, `exchangeRate Decimal(18,8)`
- `app/api/parties/[id]/deposits/route.ts` — POST/PATCH with date/rate, audit fix
- `app/api/transactions/[...]/route.ts` — 4 refund callers thread `depositDate` + `exchangeRate`
- `lib/deposit-usage.ts` — `createDepositFromRefund` signature
- `components/deposit-form.tsx` — DatePicker for `depositDate`, exchangeRate input
- `components/summary-report-table.tsx` — UTC boundary fix, VND column scoping
- `lib/summary-report.ts` — Date window normalization, VND calculation

## Why This Matters

**Data integrity:** UTC boundary bug would have silently dropped deposits at period edges on live UTC+7 database. Refund auto-create would crash on every refund.

**Audit fidelity:** Logging request instead of row meant audit trail lied about what was stored.

**Report accuracy:** Unbounded rate validator could overflow; VND logic incorrectly applied to non-deposit rows.

Red-team review caught the first two before code was written. Type-check clean, 37 tests pass, code review found 0 bugs.

## Process Note

Plan → Red-team (3 reviewers) → 11 findings applied (2 Critical, 4 High, 5 Medium) → implementation. Hostile review was essential: both Critical bugs are silent data loss/corruption, invisible in happy-path testing.

## Commits

- (Working tree, not yet committed)

**Status**: DONE
