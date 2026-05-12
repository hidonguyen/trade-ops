# Phase 03 — Audit + Smoke Test

**Effort:** 0.5h

## Audit
- Add action constant `DELETE_ORDER` in `lib/audit.ts`.
- Snapshot full order (incl. party/currency/expenseType refs) in `before`.
- Audit row survives the order delete (no FK from audit → order, or use `onDelete: SetNull` if FK exists).

## Smoke test
- [ ] Admin delete order without TX → row gone from DB; audit log has full snapshot.
- [ ] Admin delete order with TX → 409.
- [ ] Non-admin: button hidden + DELETE API → 403.
- [ ] Same `orderNumber` reusable for same party after delete.
- [ ] Reports/lists no longer show deleted order (automatic — row is gone).
- [ ] Audit log query shows DELETE_ORDER entry with `before` snapshot.
