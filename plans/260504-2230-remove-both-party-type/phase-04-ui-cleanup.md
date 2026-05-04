# Phase 04 — UI + Export Cleanup

## Overview
- Priority: P1
- Status: pending (blocked by phase-03)
- Strip BOTH from the form option list, sidebar/nav highlight logic, party list+detail pages, and the summary export route.

## Key Insights
- After narrowing `Party.type` to `"CUSTOMER" | "SUPPLIER"`, TypeScript flags every dead branch. Use compiler errors as a checklist.
- Sidebar/nav default fallback simplifies — remove the BOTH branch and rely on null/undefined.

## Requirements
- No `"BOTH"` literal or `"KH & NCC"` label anywhere under `app/`, `components/`.
- Form, sidebar highlight, nav-highlight provider, list page, detail page, and summary export typecheck and render correctly.

## Related Code Files
- Modify: `components/party-form.tsx` (lines 14, 36)
- Modify: `components/layout/sidebar.tsx` (lines 80, 109-110)
- Modify: `components/providers/nav-highlight-provider.tsx` (lines 11, 58)
- Modify: `app/(dashboard)/parties/page.tsx` (line 126)
- Modify: `app/(dashboard)/parties/[id]/page.tsx` (lines 28, 46, 69, 102, 120, 126)
- Modify: `app/api/reports/summary/export/route.ts` (line 252)

## Implementation Steps
1. **Form** (`components/party-form.tsx`):
   - Line 14: union becomes `"CUSTOMER" | "SUPPLIER"`.
   - Line 36: remove `{ value: "BOTH", label: "Vừa KH vừa NCC" }` option.
2. **Sidebar** (`components/layout/sidebar.tsx`):
   - Lines 80, 109-110: drop BOTH highlight branch — single-module match.
3. **Nav highlight** (`components/providers/nav-highlight-provider.tsx`):
   - Lines 11, 58: type tracker becomes `"CUSTOMER" | "SUPPLIER" | null`. Remove BOTH fallback.
4. **Party list** (`app/(dashboard)/parties/page.tsx:126`):
   - Drop BOTH branch in back-link logic.
5. **Party detail** (`app/(dashboard)/parties/[id]/page.tsx`):
   - Line 28: drop `"BOTH": "KH & NCC"` label entry.
   - Line 46: simplify sidebar highlight default.
   - Lines 69, 102, 120, 126: collapse `type === "CUSTOMER" || type === "BOTH"` → `type === "CUSTOMER"`; same for SUPPLIER. Remove BOTH-only conditionals (deposit creation buttons render based on exact type).
6. **Summary export** (`app/api/reports/summary/export/route.ts:252`):
   - Drop `|| party.type === "BOTH"` from deposit routing check.
7. `pnpm typecheck && pnpm build`.
8. Manual smoke: render customer detail, supplier detail, party form (create + edit), sidebar highlight on each page, summary export.

## Todo
- [ ] party-form.tsx union + option pruned
- [ ] sidebar.tsx BOTH branch removed
- [ ] nav-highlight-provider.tsx narrowed
- [ ] parties/page.tsx back-link cleaned
- [ ] parties/[id]/page.tsx labels + conditionals cleaned
- [ ] summary export route updated
- [ ] `pnpm typecheck` and `pnpm build` pass
- [ ] Smoke test: form, sidebar, list, detail, export

## Success Criteria
- `grep -rn "BOTH\|KH & NCC\|Vừa KH vừa NCC" app components` → empty.
- Customer detail shows only customer sections; supplier detail shows only supplier sections.
- Summary export still routes deposits correctly (now keyed only on CUSTOMER).

## Risk Assessment
- **Medium**: missed conditional branch leaves a section hidden for valid party. Mitigation: rely on TypeScript narrowing errors + manual smoke for both types.
- **Low**: UI label still references BOTH in i18n string. Mitigation: grep also Vietnamese label `"KH & NCC"` and `"Vừa KH vừa NCC"`.

## Rollback
- `git revert`. No data implications.

## Next Steps
Plan complete. Unblocks `260504-2224-summary-report-deposits-and-fees`.
