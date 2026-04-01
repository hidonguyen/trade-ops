# Phase 1: Foundation Setup

## Context Links
- [System Architecture](../../docs/system-architecture.md) -- data model, auth flow
- [Code Standards](../../docs/code-standards.md) -- conventions
- [Deployment Guide](../../docs/deployment-guide.md) -- docker, env vars
- [Codebase Summary](../../docs/codebase-summary.md) -- directory structure

## Overview
- **Priority:** P0 (Critical Gate)
- **Status:** Planned
- **Effort:** 8h
- **Description:** Initialize Next.js project, install all dependencies, configure Docker/PostgreSQL, create Prisma schema with all models, seed data, configure NextAuth v5, build lib helpers, type definitions, and login page.

## Key Insights
- uuid(7) requires Prisma 5.10+ -- verify version in package.json
- NextAuth v5 uses `auth()` export pattern, not `getServerSession()`
- All Decimal fields must be `@db.Decimal(18,4)`, exchange rates `@db.Decimal(18,8)`
- Seed must create: admin user (bcrypt hash), BUs (TK/NT), currencies (VND/USD/RMB), expense types

## File Ownership (Exclusive)

```
package.json
tsconfig.json
next.config.ts
tailwind.config.ts
postcss.config.js
docker-compose.yml
.env.example
prisma/schema.prisma
prisma/seed.ts
lib/prisma.ts
lib/auth.ts
lib/api-helpers.ts
lib/audit.ts
lib/validation-schemas.ts
types/index.ts
types/next-auth.d.ts
middleware.ts
app/api/auth/[...nextauth]/route.ts
app/(auth)/login/page.tsx
app/layout.tsx
app/globals.css
```

## Implementation Steps

### 1. Project Init (1h)
1. `npx create-next-app@latest trade-ops --typescript --tailwind --app --src-dir=false`
2. Install deps: `prisma @prisma/client next-auth@5 zod decimal.js exceljs recharts bcrypt @types/bcrypt`
3. Install shadcn/ui: `npx shadcn-ui@latest init` with navy blue theme
4. Configure `tsconfig.json` with `@/*` path alias
5. Configure `tailwind.config.ts` with design system colors from design-guidelines.md
6. Add IBM Plex Sans + IBM Plex Mono fonts in `app/layout.tsx`

### 2. Docker + Database (1h)
1. Create `docker-compose.yml`: PostgreSQL 14 + pgAdmin
2. Create `.env.example` with DATABASE_URL, NEXTAUTH_URL, NEXTAUTH_SECRET
3. `npx prisma init`

### 3. Prisma Schema (2h)
1. Define all models in `prisma/schema.prisma`:
   - User, UserRoleAssignment, AuditLog
   - BusinessUnit, Currency, ExpenseType
   - Party, Deposit, DepositUsage
   - Order, Transaction
2. All money fields: `Decimal @db.Decimal(18,4)`
3. exchangeRate: `Decimal @db.Decimal(18,8)`
4. All IDs: `@default(uuid(7))`
5. Add indexes per system-architecture.md
6. Add unique constraints: `UserRoleAssignment(userId, role)`, `BusinessUnit(code)`, `Currency(code)`
7. Run `npx prisma migrate dev --name init`

### 4. Seed Script (1h)
1. Create `prisma/seed.ts`
2. Seed admin user: email `admin@example.com`, bcrypt-hashed password
3. Seed BUs: TK ("Truong Khang"), NT ("Nhien Thuy")
4. Seed currencies: VND/$/Y with symbols
5. Seed expense types: Utilities, Salary, Rent, Shipping, Customs, Other
6. Add `prisma.seed` config to `package.json`

### 5. Type Definitions (0.5h)
1. `types/index.ts`: ApiResponse<T>, PaginatedResponse<T>, enums (OrderStatus, PartyType, TransactionType, PaymentMethod, PaymentType, UserRole, AuditAction)
2. `types/next-auth.d.ts`: Extend Session/JWT with `id`, `roles`, `name`

### 6. Lib Helpers (2h)
1. `lib/prisma.ts`: PrismaClient singleton (globalThis pattern)
2. `lib/auth.ts`: NextAuth v5 config with CredentialsProvider, JWT callbacks loading roles from DB
3. `lib/api-helpers.ts`: `withAuth(request)`, `checkAccess(user, action, module)` with full RBAC matrix, `apiResponse()` helper
4. `lib/audit.ts`: `createAuditLog(userId, action, model, recordId, changes?, txClient?)` -- works inside $transaction
5. `lib/validation-schemas.ts`: Decimal string validator, reusable pagination schema, createOrder/createTransaction/createParty schemas

### 7. Auth Route + Middleware (0.5h)
1. `app/api/auth/[...nextauth]/route.ts`: Export GET/POST from auth config
2. `middleware.ts`: Protect `/dashboard/*` routes, redirect unauthenticated to `/login`

### 8. Login Page + Root Layout (1h)
1. `app/layout.tsx`: Root layout with fonts, metadata, Tailwind
2. `app/globals.css`: Tailwind directives + CSS custom properties from design-guidelines.md
3. `app/(auth)/login/page.tsx`: Email/password form, NextAuth signIn("credentials"), error display

## RBAC Permission Matrix (implemented in lib/api-helpers.ts)

| Dimension | ADMIN | ACCT_SALE | ACCT_PURCHASE | ACCT_CASHFLOW | VIEWER |
|-----------|:-----:|:---------:|:-------------:|:-------------:|:------:|
| SALE | FULL | FULL | GET | GET | GET |
| PURCHASE | FULL | GET | FULL | GET | GET |
| CUSTOMER | FULL | FULL | GET | GET | GET |
| SUPPLIER | FULL | GET | FULL | GET | GET |
| RECEIPT | FULL | FULL | DENY | FULL | GET |
| PAYMENT | FULL | DENY | FULL | FULL | GET |
| CASHFLOW | FULL | FULL | FULL | FULL | GET |
| DASHBOARD | FULL | FULL | FULL | FULL | FULL |
| ADMIN | FULL | DENY | DENY | DENY | DENY |

## Todo Checklist

- [ ] Init Next.js project with all deps
- [ ] Configure Tailwind with design system tokens
- [ ] docker-compose.yml for PostgreSQL + pgAdmin
- [ ] .env.example with all required vars
- [ ] Prisma schema with all 10 models
- [ ] Run initial migration
- [ ] Seed script (admin, BUs, currencies, expense types)
- [ ] types/index.ts with all enums and interfaces
- [ ] types/next-auth.d.ts session extension
- [ ] lib/prisma.ts singleton
- [ ] lib/auth.ts NextAuth v5 config
- [ ] lib/api-helpers.ts (withAuth, checkAccess, apiResponse)
- [ ] lib/audit.ts audit logger
- [ ] lib/validation-schemas.ts zod schemas
- [ ] middleware.ts route protection
- [ ] app/api/auth/[...nextauth]/route.ts
- [ ] app/(auth)/login/page.tsx
- [ ] app/layout.tsx + app/globals.css
- [ ] Verify: `npm run build` succeeds
- [ ] Verify: login works end-to-end

## Success Criteria
1. `docker-compose up -d` starts PostgreSQL
2. `npx prisma migrate dev` applies without error
3. `npx prisma db seed` creates admin + base data
4. `npm run build` compiles without TypeScript errors
5. Login page renders, credentials auth works, JWT session created
6. Protected routes redirect to /login when unauthenticated
7. `checkAccess()` returns correct boolean for all role/module/action combos

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| NextAuth v5 breaking API change | Medium | High | Pin exact version; test auth flow early |
| Prisma uuid(7) not available | Low | High | Verify Prisma >= 5.10 in package.json |
| Tailwind + shadcn theme conflict | Low | Medium | Init shadcn first, then override |
| Seed script bcrypt async issue | Low | Low | Use bcryptjs (sync) or await properly |

## Security Considerations
- NEXTAUTH_SECRET must be 32+ chars random
- Password hashing via bcrypt (salt rounds: 12)
- JWT httpOnly cookie, secure in production
- middleware.ts blocks all /dashboard routes for unauthenticated
- No credentials stored in code or .env.example
