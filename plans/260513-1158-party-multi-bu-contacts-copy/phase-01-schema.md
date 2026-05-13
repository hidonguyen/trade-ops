# Phase 01 — Schema

**Effort:** 4h

## Changes

### `Party` (giữ nguyên `businessUnitId` làm "primary/origin BU")
Không xóa cột để tránh phải đổi unique key + tránh break audit log cũ.

### New: `PartyBusinessUnit` (M2M)
```prisma
model PartyBusinessUnit {
  partyId        String
  businessUnitId String
  party          Party        @relation(fields: [partyId], references: [id], onDelete: Cascade)
  businessUnit   BusinessUnit @relation(fields: [businessUnitId], references: [id])

  @@id([partyId, businessUnitId])
  @@index([businessUnitId])
}
```
Add inverse relation on both `Party` and `BusinessUnit`.

### New: `Contact`
```prisma
model Contact {
  id        String   @id @default(uuid(7))
  name      String
  phone     String?
  email     String?
  taxId     String?  // MST cá nhân
  address   String?
  notes     String?
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  transactions Transaction[]

  @@index([name])
  @@index([phone])
}
```

### `Transaction`
Add `contactId String?` + relation.

## Migration (hand-edit)
1. `CREATE TABLE "PartyBusinessUnit"` + indexes.
2. Backfill: `INSERT INTO "PartyBusinessUnit"(partyId, businessUnitId) SELECT id, "businessUnitId" FROM "Party";`
3. `CREATE TABLE "Contact"` + indexes.
4. `ALTER TABLE "Transaction" ADD COLUMN "contactId" TEXT REFERENCES "Contact"(id);`

## Todo
- [ ] Schema update
- [ ] `prisma migrate dev` — review SQL
- [ ] Hand-edit backfill SQL
- [ ] Verify row counts: `SELECT COUNT(*) FROM "PartyBusinessUnit"` == `SELECT COUNT(*) FROM "Party"`

## Success
Schema generated; existing party/transaction data intact; query `prisma.party.findMany({ include: { businessUnits: true } })` works.
