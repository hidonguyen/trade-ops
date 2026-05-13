# Phase 06 — Tests + Docs

**Effort:** 2h | **Status:** planned

## Tests
- Unit: `checkAccess` matrix × BU combinations.
- Unit: `accessibleBusinessUnits` for ADMIN, multi-BU user, single-BU user.
- Integration (manual smoke if no test runner): cross-BU forbidden write returns 403; list filter excludes inaccessible rows.

## Docs
- Update `docs/system-architecture.md` → RBAC section: add BU dimension.
- Update `docs/code-standards.md` → API handler must call `requireAccess(req, action, module, buId)`.
- README: note multi-BU permissions.

## Todo
- [ ] Unit tests for rbac.ts
- [ ] Update system-architecture.md
- [ ] Update code-standards.md
- [ ] README note
