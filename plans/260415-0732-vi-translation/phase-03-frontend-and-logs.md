# Phase 03 — Frontend catch/toast + console logs

## Overview
- Priority: Medium
- Status: pending
- Depends on: Phase 01 (for MSG imports)

## Scope

### Frontend catch/setError

Replace English strings in:
- `setError("Network error")` → `setError(MSG.networkError)`
- `setError(err instanceof Error ? err.message : "Unknown error")` → `setError(err instanceof Error ? err.message : MSG.unknownError)`
- `throw new Error("Failed to ...")` used as user-visible → VN equivalent

**Keep** technical/debug strings passed to `console.error` prefixes (e.g. `"POST /api/orders error:"`) — they identify the source, not user-facing.

### Client-side validation toast / inline messages

Most VN already (Vietnamese comments visible earlier). Audit:
- `components/*.tsx` — `setError("...")` and `throw new Error("...")` calls
- `app/(dashboard)/**/*.tsx` — same

### Console logs (dev-facing, human prose)

Examples to translate the human-readable part, keep route prefix:
- `console.error("Failed to fetch cashflow:", err)` → `console.error("[cashflow] lỗi tải dữ liệu:", err)` — optional; user included this in scope but value is marginal.

**Decision:** Translate the _user-visible_ error log prefixes only (very few); keep internal route identifiers + stack traces untouched.

## Files

- Modify: `components/*.tsx` (forms, dialogs)
- Modify: `app/(dashboard)/**/page.tsx` (client pages with `setError`)

## Todo

- [ ] Grep frontend English strings: `grep -rn 'setError("' components/ app/(dashboard)/`
- [ ] Replace with `MSG.*` or inline VN
- [ ] Grep `throw new Error("` on client files for user-visible messages
- [ ] Grep `console.error("` — translate human prose only (keep stack/id prefixes)
- [ ] Manual test: force a 500 via API → toast shows VN
- [ ] Manual test: validation failure → shows VN field error

## Success Criteria

- No English user-visible toast / error message during normal error paths.
- Type-check clean.

## Risks

- Missing interpolated messages embedded in JSX. Grep `> [A-Z]` in .tsx likely surfaces them.
- Translated logs may break log aggregation pattern — keep route prefixes English + stable.
