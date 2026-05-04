# Phase 01 — UI + API: filter depleted, expand-all

## Files
- `app/api/reports/deposits/route.ts`
- `app/(dashboard)/reports/deposits/page.tsx`

## Steps

### A. API
1. Add query param `hideDepleted` (default `"true"`).
2. Filter: `if (hideDepleted && new Decimal(dep.remainingOriginal.toString()).isZero()) continue;` placed AFTER usage filter logic to skip after deciding visible usages.

### B. UI
1. **State**: `const [hideDepleted, setHideDepleted] = useState(true);` — default true.
2. **URL param**: pass `hideDepleted: String(hideDepleted)` in fetch URL; add to dep array.
3. **Drop expand state** (`expanded` Set + `toggle`). Render usage list inline always.
4. **Drop chevron column** (collapse the indicator slot to width: 0 or remove). Master row width re-balance.
5. **Toggle UI**: checkbox cạnh DateQuickPresets:
   ```tsx
   <label className="flex items-center gap-2 text-sm text-slate-600 select-none cursor-pointer">
     <input type="checkbox" checked={hideDepleted}
       onChange={(e) => setHideDepleted(e.target.checked)}
       className="size-4 rounded border-slate-300" />
     Ẩn cọc đã hết số dư
   </label>
   ```
6. Compile check.

## Todo
- [ ] API: hideDepleted param + filter
- [ ] UI: state + param + checkbox
- [ ] Drop expand/collapse logic
- [ ] Always render detail block
- [ ] Compile check

## Success
- Load default: deposit có remaining=0 ẩn.
- Toggle off → hiện đầy đủ.
- Mọi deposit hiển thị detail ngay (không click).

## Risk
- **None significant**. Filter additive; UI simplifies.
