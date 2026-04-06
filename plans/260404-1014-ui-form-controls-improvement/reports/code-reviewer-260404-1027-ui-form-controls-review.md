# Code Review: UI Form Controls Improvement

## Scope
- **New files:** `components/ui/combobox.tsx`, `components/ui/date-picker.tsx`, `components/ui/number-input.tsx`
- **Modified:** `order-form.tsx`, `transaction-form.tsx`, `payment-form.tsx`, `deposit-form.tsx`, `party-form.tsx`, `filter-bar.tsx`, `app/api/orders/route.ts`, `app/(dashboard)/orders/page.tsx`
- **LOC:** ~1,200 across 11 files

## Overall Assessment
Solid implementation. Components are well-structured, Vietnamese locale handling is thoughtful (NFD normalization + d/D replacement), and Decimal.js usage for currency math is correct. Several issues need attention before shipping.

---

## Critical Issues

### C1. Date filter params not validated — Invalid Date propagates to Prisma
**File:** `app/api/orders/route.ts:47-49`

`dateFrom`/`dateTo` are passed directly to `new Date()` without validation. A malformed string like `dateFrom=not-a-date` produces `Invalid Date`, which Prisma will either reject with an unhandled error or silently skip.

```ts
// Current — no validation
const orderDateFilter = (dateFrom || dateTo) ? {
  ...(dateFrom && { gte: new Date(dateFrom) }),
  ...(dateTo && { lte: new Date(`${dateTo}T23:59:59.999Z`) }),
} : undefined;
```

**Fix:** Validate ISO date format before constructing Date objects:
```ts
function isValidIsoDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(s).getTime());
}

const parsedFrom = dateFrom && isValidIsoDate(dateFrom) ? new Date(dateFrom) : undefined;
const parsedTo = dateTo && isValidIsoDate(dateTo) ? new Date(`${dateTo}T23:59:59.999Z`) : undefined;
```

**Impact:** Server 500 on malformed date params. Not SQL injection (Prisma parameterizes), but causes unhandled errors and exposes stack traces via `console.error`.

### C2. `sortBy` query param injected directly into Prisma `orderBy` — previously flagged, still present
**File:** `app/api/orders/route.ts:65`, `lib/api-helpers.ts:73`

`parsePagination` accepts arbitrary `sortBy` values from the query string and passes them to `{ [sortBy]: order }`. A non-existent column causes Prisma to throw, leaking internal error details. This was flagged in a prior review (`code-review-260402-0144`).

**Fix:** Whitelist valid sort columns per resource:
```ts
const ALLOWED_SORT = ["createdAt", "orderDate", "amountOriginal", "status"];
const sortBy = ALLOWED_SORT.includes(raw) ? raw : "createdAt";
```

---

## High Priority

### H1. Combobox missing ARIA attributes — not accessible to screen readers
**File:** `components/ui/combobox.tsx`

The search input and option buttons have no ARIA roles/attributes. The component functions as a listbox pattern but lacks:
- `role="combobox"` on the search input
- `aria-expanded`, `aria-controls`, `aria-activedescendant` on the input
- `role="listbox"` on the options container
- `role="option"` + `aria-selected` on each option
- `id` attributes linking `aria-controls` and `aria-activedescendant`

**Impact:** Unusable for screen reader users. Vietnamese government accessibility requirements may apply.

**Fix:** Add standard WAI-ARIA combobox pattern attributes. Reference: [WAI-ARIA Combobox](https://www.w3.org/WAI/ARIA/apd/patterns/combobox/).

### H2. NumberInput `min` validation blocks typing intermediate values
**File:** `components/ui/number-input.tsx:53-57`

When `min={0}`, typing a negative number is correctly blocked. But the check fires on every keystroke, which means a user typing `5` then deleting to type `3` can't type `0` then `3` if an intermediate value like `03` parses to `3` (this is fine). However, the real issue: **users cannot type values where intermediate state is below min**. For example, if `min=100`, the user cannot type `5` (which is `< 100`) on the way to typing `500`.

```ts
if (min !== undefined && raw !== "" && raw !== "-") {
  const num = parseFloat(raw);
  if (!isNaN(num) && num < min) return; // blocks keystroke
}
```

**Fix:** Only enforce `min` on blur, not on change:
```ts
function handleBlur() {
  setFocused(false);
  if (value && value !== "-") {
    const num = parseFloat(value);
    if (!isNaN(num)) {
      const clamped = min !== undefined ? Math.max(min, num) : num;
      onChange(String(clamped));
    }
  }
}
```

Current code works fine for `min={0}` (the only usage), but the API contract is misleading for any other `min` value.

### H3. DatePicker has no way to clear selection
**File:** `components/ui/date-picker.tsx`

The `handleSelect` function ignores `undefined` (line 33-36), and there's no clear button. Once a date is selected, the user cannot clear it. For the date-range filter in `filter-bar.tsx`, this means once a date range is set, it can't be removed without a page refresh.

**Fix:** Add a clear button inside the popover or allow clicking the selected date to deselect:
```ts
function handleSelect(day: Date | undefined) {
  if (day) {
    onChange(format(day, "yyyy-MM-dd"));
  } else {
    onChange("");
  }
  setOpen(false);
}
```
And add a clear button in the trigger when value exists.

---

## Medium Priority

### M1. Vietnamese diacritics normalize() misses uppercase D before lowercasing
**File:** `components/ui/combobox.tsx:26-32`

The function lowercases first, then replaces `Đ` (uppercase). The uppercase replacement is dead code because `.toLowerCase()` already ran.

```ts
return str
  .toLowerCase()          // "Đ" becomes "đ" here
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/đ/g, "d")
  .replace(/Đ/g, "D");   // never matches — already lowered
```

**Fix:** Remove the dead `.replace(/Đ/g, "D")` line. Functionally harmless since `đ` is handled, but misleading code.

### M2. `SelectItem value=""` in filter-bar may not work with Radix/shadcn Select
**File:** `components/shared/filter-bar.tsx:87`

`<SelectItem value="">Tat ca</SelectItem>` — Radix Select historically disallows empty string as a value (throws a warning or silently ignores selection). This could cause the "All" filter option to not work.

**Fix:** Use a sentinel value like `"__all__"` and map it back to empty string in the handler, or test to confirm current shadcn version accepts empty strings.

### M3. Combobox `focusIndex` not reset when search text reduces filtered list
**File:** `components/ui/combobox.tsx:125`

The `onChange` handler resets `focusIndex` to 0 on search change (good). But if the user arrows down to index 5, then types more text reducing filtered to 2 items, the arrow key handler at line 81 uses `Math.min(i + 1, filtered.length - 1)` which would clamp correctly. So this is actually safe. No action needed.

### M4. Multiple forms fetch the same reference data independently
**Files:** `order-form.tsx`, `transaction-form.tsx`, `deposit-form.tsx`, `party-form.tsx`

Each form has its own `useEffect` fetching `/api/business-units` and `/api/currencies`. Consider a shared hook or SWR/React Query to deduplicate and cache.

**Impact:** Extra network requests, but not a correctness issue. Low priority refactor.

### M5. `payment-form.tsx` deposits not reloaded when dialog reopens
**File:** `components/payment-form.tsx:91-96`

The form state resets on open (line 91-96), but the `deposits` state is not cleared. If the user opens the payment dialog, switches to DEPOSIT method (loading deposits), closes, then reopens with a different party (via different order), stale deposits could display briefly until the effect fires.

**Fix:** Clear deposits in the reset effect:
```ts
useEffect(() => {
  if (open) {
    setForm({ ...defaultForm });
    setDeposits([]);
    setError(null);
  }
}, [open]);
```

---

## Low Priority

### L1. Trigger button className strings are duplicated across Combobox and DatePicker
Both components copy-paste the same long Tailwind class string for the trigger button. Extract to a shared utility or `cva` variant.

### L2. `requestAnimationFrame` for focus is fragile
**Files:** `combobox.tsx:62`, `number-input.tsx:65`

`requestAnimationFrame` for focusing after render works but is timing-dependent. Consider `useEffect` with a ref callback or `autoFocus` on the search input.

---

## Positive Observations

1. **Decimal.js for currency math** — avoids floating-point errors in VND amount computation
2. **Vietnamese locale throughout** — date-fns `vi` locale, NFD normalization for diacritics search
3. **Consistent component API** — controlled `value`/`onChange` pattern across all three new components
4. **Prisma parameterization** — date filters go through Prisma, so no SQL injection risk despite missing validation
5. **Smart use of Base UI Popover** — proper portal rendering, anchor-width matching, animation classes
6. **onMouseDown preventDefault** — combobox option buttons prevent focus loss from search input (line 143)

---

## Recommended Actions (Prioritized)

1. **[Critical]** Validate `dateFrom`/`dateTo` format in orders API before constructing Date objects
2. **[Critical]** Whitelist `sortBy` values in `parsePagination` (pre-existing issue, affects all list APIs)
3. **[High]** Add ARIA attributes to Combobox for screen reader accessibility
4. **[High]** Move NumberInput `min` enforcement to blur handler
5. **[High]** Add clear functionality to DatePicker
6. **[Medium]** Fix dead `Đ` replacement in normalize function
7. **[Medium]** Test `SelectItem value=""` compatibility, use sentinel if needed
8. **[Medium]** Clear deposits state on PaymentForm reopen

---

## Unresolved Questions

- Does the project have accessibility compliance requirements (WCAG level)?
- Is there a plan to add debouncing to the search filter in FilterBar (currently fires on every keystroke)?
- Should DatePicker support manual text input for power users, or is calendar-only sufficient?
