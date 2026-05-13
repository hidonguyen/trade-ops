# Phase 01 — Schema + Migration

**Effort:** 4h | **Status:** planned

## Changes

### `prisma/schema.prisma`
```prisma
model UserRoleAssignment {
  id             String        @id @default(uuid(7))
  userId         String
  role           String
  businessUnitId String?       // null = global (ADMIN convention)
  assignedAt     DateTime      @default(now())
  assignedBy     String
  user           User          @relation(fields: [userId], references: [id])
  businessUnit   BusinessUnit? @relation(fields: [businessUnitId], references: [id])

  @@unique([userId, role, businessUnitId])
  @@index([userId])
  @@index([businessUnitId])
}
```

Add inverse relation on `BusinessUnit`: `userRoles UserRoleAssignment[]`.

### Migration SQL (manual, additive)
1. `ALTER TABLE "UserRoleAssignment" ADD COLUMN "businessUnitId" TEXT REFERENCES "BusinessUnit"(id);`
2. Drop old unique `(userId, role)`, add `(userId, role, businessUnitId)`.
3. Backfill non-ADMIN rows: for each active BU, insert duplicate with `businessUnitId` set; delete original non-ADMIN row with null.
4. Add index on `businessUnitId`.

### Seed
Update `prisma/seed.ts` admin user — keep null. Add example multi-BU user for dev.

## Todo
- [ ] Update schema
- [ ] Generate migration, hand-edit backfill SQL
- [ ] Run `prisma migrate dev`
- [ ] Update seed
- [ ] Verify row counts pre/post backfill

## Success
Existing users have effective access identical to pre-migration.
