# Phase 06 — Multi-select combobox filters (ALL combobox filters)

## Context

- `components/ui/combobox.tsx` is single-select.
- `components/shared/filter-bar.tsx` renders any `FilterConfig` with `type: "select"` as a `<Combobox>`.
- User decision: **ALL** combobox filters across the app become multi-select. No exceptions.

## Full inventory (audited 2026-05-12)

Every `type: "select"` declaration in pages → becomes multi-select:

| Page | Filter key | Vietnamese label | Source of options |
|---|---|---|---|
| `app/(dashboard)/orders/page.tsx` | `partyId` | Đối tác | parties fetched from `/api/parties` |
| `app/(dashboard)/orders/page.tsx` | `status` | Trạng thái TT | `STATUS_OPTIONS` constant |
| `app/(dashboard)/orders/page.tsx` | `expenseTypeId` | Loại chi phí (PURCHASE only) | `/api/expense-types` |
| `app/(dashboard)/transactions/page.tsx` | `type` | Loại giao dịch | `TYPE_OPTIONS` |
| `app/(dashboard)/transactions/page.tsx` | `paymentMethod` | Phương thức | `METHOD_OPTIONS` (includes new CASH from phase 04) |
| `app/(dashboard)/transactions/page.tsx` | `expenseTypeId` | Loại chi phí | `/api/expense-types` |
| `app/(dashboard)/reports/cashflow/page.tsx` | `currencyId` | Tiền tệ | currencies |
| `app/(dashboard)/reports/bank-fees/page.tsx` | `currencyId` | Tiền tệ | currencies |
| `app/(dashboard)/reports/deposits/page.tsx` | `partyId` | Đối tác | parties |
| `app/(dashboard)/reports/deposits/page.tsx` | `currencyId` | Tiền tệ | currencies |
| `app/(dashboard)/settings/audit-logs/page.tsx` | `userId` | Người dùng | users |
| `app/(dashboard)/settings/audit-logs/page.tsx` | `model` | Đối tượng | `MODEL_OPTIONS` |
| `app/(dashboard)/settings/audit-logs/page.tsx` | `action` | Hành động | `ACTION_OPTIONS` |

13 filters total across 7 pages. No filter is excluded. Note: no `role` filter exists in the codebase (settings/users page uses no combobox filter). If future pages add a `type: "select"` filter, they automatically inherit multi-select from `FilterBar`.

## Requirements

- Selected values render as chips inside the trigger; per-chip "X" removes one; trailing clear-all "X" clears all.
- Empty selection = no filter applied (semantically identical to omitting the key).
- URL serialization: **comma-separated CSV** (`partyId=a,b,c`) — chosen for: (a) backward compatibility with existing single-value bookmarks (CSV split of `"a"` → `["a"]`), (b) Excel export URL builders unchanged structurally, (c) shorter URLs than repeated params.
- Backend: parse CSV → `where: { [key]: { in: [...] } }` (or enum equivalent). Single value still hits same code path.
- Reserved characters: filter values in this app are IDs (cuid/uuid) or enum constants (uppercase) — neither contains commas. KISS: no escaping needed. Document this assumption in `multi-combobox.tsx`.

## URL serialization spec

| Case | URL example | Server parse → Prisma where |
|---|---|---|
| None selected | (key omitted) | no clause |
| Single | `partyId=abc` | `{ partyId: { in: ["abc"] } }` (or `{ partyId: "abc" }` — same result) |
| Multi | `partyId=abc,def,ghi` | `{ partyId: { in: ["abc","def","ghi"] } }` |
| Trailing comma / empty token | `partyId=abc,,def` | filtered via `.filter(Boolean)` → `["abc","def"]` |
| Empty value | `partyId=` | `.filter(Boolean)` → `[]` → no clause |

Server-side helper (new, `lib/api-helpers.ts`):
```ts
export function parseCsvParam(sp: URLSearchParams, key: string): string[] {
  const raw = sp.get(key);
  if (!raw) return [];
  return raw.split(",").map(s => s.trim()).filter(Boolean);
}
```

## Files

- Create: `components/ui/multi-combobox.tsx` (NEW — keeps single `combobox.tsx` untouched).
- Modify: `components/shared/filter-bar.tsx` — add `multiple?: boolean` to `FilterConfig`; route to MultiCombobox when true. Default `multiple: true` for ALL `type: "select"` filters (per user decision: ALL become multi-select). Note: since user wants ALL multi-select, simplest implementation is to make `type: "select"` always render MultiCombobox — no flag needed. KISS preferred.
- Modify: `lib/api-helpers.ts` — add `parseCsvParam` helper.
- Modify (page filter state + API parsing):
  - `app/(dashboard)/orders/page.tsx` + `app/api/orders/route.ts`
  - `app/(dashboard)/transactions/page.tsx` + `app/api/transactions/route.ts`
  - `app/(dashboard)/reports/cashflow/page.tsx` + `app/api/reports/cashflow/route.ts`
  - `app/(dashboard)/reports/bank-fees/page.tsx` + `app/api/reports/bank-fees/route.ts`
  - `app/(dashboard)/reports/deposits/page.tsx` + `app/api/reports/deposits/route.ts`
  - `app/(dashboard)/settings/audit-logs/page.tsx` + `app/api/audit-logs/route.ts`
- Verify (read-only): Excel/PDF export builders — confirm they include filter params in CSV form. If any builder reads single-value filter state, update to join arrays.

## Implementation decisions (KISS)

- New `multi-combobox.tsx` rather than overloading `combobox.tsx` — fewer prop unions, easier to reason about.
- Simplify `filter-bar.tsx`: drop the per-filter `multiple` flag; route ALL `type: "select"` → MultiCombobox unconditionally (matches user requirement "ALL combobox filters become multi-select").
- `onFilterChange(key, value)` signature stays string — pass CSV string to keep contract stable across `FilterBar` consumers; pages still treat URL serialization centrally.
- No deep escape logic — IDs and enum tokens have no commas.

## Implementation steps

1. Build `components/ui/multi-combobox.tsx`:
   - Props: `values: string[]`, `onValuesChange: (next: string[]) => void`, `options`, `placeholder`, `className`.
   - Internal: popover with searchable list, checkbox left of each row, chips rendered in trigger (truncate after 2; "+N more" badge).
   - Footer actions: "Xóa tất cả" (clear all).
2. Add `parseCsvParam` to `lib/api-helpers.ts`.
3. Update `filter-bar.tsx`:
   - Branch on `type === "select"` → split current `values[key]` CSV into array, pass to `<MultiCombobox values={...} onValuesChange={(arr) => onFilterChange(filter.key, arr.join(","))}>`.
   - "Tất cả" sentinel option removed (empty array = all).
4. For each page in the inventory:
   - State remains `string` (CSV) — no schema change for `useFilters` hook.
   - URL sync: existing search-params hook stores string as-is. Verify nothing parses single value with `===` against ID.
5. For each matching API route:
   - Replace `const partyId = sp.get("partyId"); if (partyId) where.partyId = partyId;` with:
     ```ts
     const partyIds = parseCsvParam(sp, "partyId");
     if (partyIds.length) where.partyId = { in: partyIds };
     ```
   - Apply same pattern for: `status`, `expenseTypeId`, `type`, `paymentMethod`, `currencyId`, `userId`, `model`, `action`.
   - Confirm Prisma field types accept `{ in: string[] }` (enum fields → cast values, e.g. `paymentStatus: { in: partyStatuses as OrderPaymentStatus[] }`).
6. Smoke-test each page: select 2 values → list shows union; URL has CSV; refresh restores selection; clear all → unfiltered.
7. Confirm old single-value bookmarks (`?partyId=abc`) still load correctly.
8. Confirm Excel export URL builders pass the same CSV through.

## Todo

- [ ] Build `components/ui/multi-combobox.tsx`
- [ ] Add `parseCsvParam` helper in `lib/api-helpers.ts`
- [ ] Update `filter-bar.tsx` to render MultiCombobox for all `type: "select"`
- [ ] Migrate orders page + API (partyId, status, expenseTypeId)
- [ ] Migrate transactions page + API (type, paymentMethod, expenseTypeId)
- [ ] Migrate reports/cashflow page + API (currencyId)
- [ ] Migrate reports/bank-fees page + API (currencyId)
- [ ] Migrate reports/deposits page + API (partyId, currencyId)
- [ ] Migrate audit-logs page + API (userId, model, action)
- [ ] Verify Excel/PDF export URL builders for each report
- [ ] Smoke test: multi-select on each page returns union
- [ ] Smoke test: legacy single-value URLs still work

## Success criteria

- All 13 inventoried filters accept multi-select.
- URL serializes selections as CSV; single-value form remains valid.
- API returns union (OR) of selected values via Prisma `{ in: [...] }`.
- Excel/PDF exports respect multi-selected filters.
- No regressions: empty selection behaves identical to pre-change "Tất cả".

## Risks

- **Medium**: missed API route still parsing single value → silently drops filter. Mitigation: grep `searchParams.get("partyId"|"status"|"type"|"paymentMethod"|"currencyId"|"expenseTypeId"|"userId"|"model"|"action")` and convert all hits.
- **Medium**: Prisma enum cast required for enum fields (`paymentStatus`, `paymentMethod`, audit `action`). Mitigation: explicit `as` casts; TypeScript will catch missed ones.
- **Low**: Long URL when selecting 50+ items. Acceptable for current data scale.
- **Low**: Existing bookmarks using single-value URLs — preserved by CSV split returning 1-element array.

## Rollback

- Each page+API pair revertable in isolation (one PR per page if needed, though single bundled PR preferred).
- `multi-combobox.tsx` is additive; deleting it + reverting `filter-bar.tsx` restores prior UX.
