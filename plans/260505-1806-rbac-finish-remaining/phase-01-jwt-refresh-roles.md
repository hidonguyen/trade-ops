# Phase 1 — JWT auto-refresh roles

## Problem
`lib/auth.ts` jwt callback only sets `token.roles` when `user` is present (sign-in). After admin changes a user's roles in DB, the user keeps stale roles in JWT until session expires (30 days) or they re-login.

## Fix
Add periodic re-fetch in jwt callback: every N minutes (or every request — cheap because Prisma is fast for a single user), look up fresh roles from DB.

```ts
async jwt({ token, user }) {
  if (user) {
    token.id = user.id!;
    token.roles = (user as any).roles;
    token.rolesFetchedAt = Date.now();
    return token;
  }
  // Re-fetch roles every 5 minutes to pick up admin changes without forcing re-login
  const STALE_MS = 5 * 60 * 1000;
  const fetchedAt = (token.rolesFetchedAt as number) ?? 0;
  if (token.id && Date.now() - fetchedAt > STALE_MS) {
    const fresh = await prisma.user.findUnique({
      where: { id: token.id as string, isActive: true },
      include: { roles: true },
    });
    if (!fresh) {
      // user disabled/deleted → invalidate
      return { ...token, roles: [], rolesFetchedAt: Date.now() };
    }
    token.roles = fresh.roles.map((r: any) => r.role);
    token.rolesFetchedAt = Date.now();
  }
  return token;
}
```

Trade-off: extra DB query every 5 min per active session. Acceptable scale.

## Todo
- [ ] Update `lib/auth.ts` jwt callback
- [ ] Add `rolesFetchedAt` to NextAuth JWT type augmentation if exists
- [ ] Manual verify: change a user's role in DB → within 5 min, sidebar/buttons update on next page nav
- [ ] `tsc --noEmit` clean

## Success Criteria
- Role changes take effect within 5 minutes of any subsequent request.
- Disabled/deleted user → empty roles → access blocked.
