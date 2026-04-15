---
title: Vietnamese translation of all user-facing messages
created: 2026-04-15
status: completed
blockedBy: []
blocks: []
---

# Overview

Translate all user-facing messages to Vietnamese via a centralized `lib/messages.ts` module. Scope confirmed:

1. API response `message` field (~194 occurrences across `app/api/`)
2. Zod validation messages (field-level, via shared schemas)
3. Frontend catch/toast/setError messages
4. Console logs (dev-facing; lower priority but included)

## Strategy

- Single source of truth: `lib/messages.ts` exports named constants + small helper functions for parameterized strings (e.g. `notFound("đơn hàng")` → `"Không tìm thấy đơn hàng"`).
- Avoid string interpolation in call sites — compose via helpers.
- Keep English log lines for stack traces / technical identifiers (file paths, IDs); only translate the human-readable part.

## Phases

| # | Phase | Status |
|---|-------|--------|
| 01 | Create `lib/messages.ts` with constants + helpers | completed |
| 02 | Refactor API routes + zod schemas to use constants | completed |
| 03 | Refactor frontend catch/toast + console log human text | completed |

## Dependencies

- Phase 01 blocks 02 + 03.
- Phase 02 and 03 independent, can run in parallel.

## Scale

- ~194 API error-response call sites.
- Zod: ~40+ `.refine({ message: "..." })` + default messages.
- Frontend: ~30 `setError(...)` / `console.error(...)` human-readable strings.

## Related Files

- Create: `lib/messages.ts`
- Modify: All `app/api/**/*.ts` route files
- Modify: `lib/validation-schemas.ts`
- Modify: Client components under `components/` and `app/(dashboard)/`

## Open Questions

- Log lines currently like `console.error("POST /api/orders error:", error)` — keep endpoint identifier English, skip translation. (Decision: English route identifiers untouched; only translate human prose.)
- Should VN messages drop diacritics? No — full Unicode.
