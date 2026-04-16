// Diff helper for audit logs on UPDATE paths.
// Compares user-provided PATCH payload against the existing DB record,
// returning only the fields that actually changed, in `{ from, to }` form.

type AuditDiff = Record<string, { from: unknown; to: unknown }>;

// Prisma Decimal + Date serialize via toString(). Normalize both sides
// so Decimal("1.0000") equals "1" from the request payload, etc.
function normalize(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object" && "toString" in (value as object)) {
    // Prisma Decimal, BigInt, etc.
    return String(value);
  }
  return value;
}

function valuesEqual(a: unknown, b: unknown): boolean {
  const na = normalize(a);
  const nb = normalize(b);
  if (na === nb) return true;
  // Dates: request may send "2026-04-16" while existing is ISO with time. Normalize to date-only comparison
  // when both look like date strings and one is YYYY-MM-DD.
  if (
    typeof na === "string" &&
    typeof nb === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(na) !== /^\d{4}-\d{2}-\d{2}$/.test(nb)
  ) {
    return na.slice(0, 10) === nb.slice(0, 10);
  }
  return false;
}

export function diffForAudit(
  incoming: Record<string, unknown>,
  existing: Record<string, unknown>,
): AuditDiff {
  const diff: AuditDiff = {};
  for (const [key, newVal] of Object.entries(incoming)) {
    // PATCH: skip fields the user didn't send.
    if (newVal === undefined) continue;
    const oldVal = existing[key];
    if (!valuesEqual(oldVal, newVal)) {
      diff[key] = { from: normalize(oldVal), to: normalize(newVal) };
    }
  }
  return diff;
}
