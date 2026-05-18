# Trade Ops – Import/Export Financial Management Software

A comprehensive fullstack web application for managing financial operations in import/export businesses. Supports multi-currency transactions (VND/USD/RMB), role-based access control, and complete audit trail capabilities.

**Status:** Planning Phase  
**Current Version:** 1.0 (Pre-Release)

---

## Quick Start

### Prerequisites
- Node.js 18+
- Docker 20+
- npm 9+

### Setup (5 minutes)

```bash
# 1. Clone repository
git clone https://github.com/your-org/trade-ops.git
cd trade-ops

# 2. Install dependencies
npm install

# 3. Setup environment
cp .env.example .env.local

# 4. Start PostgreSQL
docker-compose up -d

# 5. Initialize database
npx prisma migrate dev
npx prisma db seed

# 6. Start development server
npm run dev
```

Server runs at **http://localhost:3000**

**Login with:**
- Email: admin@example.com
- Password: (see `prisma/seed.ts`)

---

## Features

### Core Modules

1. **Sales & Receivables (Bán hàng & Phải thu)**
   - Customer management
   - Sales order tracking
   - Payment receipts and refunds
   - Customer deposit management
   - Receivable aging analysis

2. **Purchases & Payables (Mua hàng & Phải trả)**
   - Supplier management
   - Purchase order tracking
   - Payment disbursements and credits
   - Supplier deposit management
   - Payable aging analysis

3. **Cash Flow (Thu Chi)**
   - Standalone receipt/payment recording
   - Deposit balance tracking
   - Cashflow trend reports
   - Multi-currency transaction support

4. **Reports & Dashboard**
   - Real-time KPI dashboard
   - Sales and purchase summaries
   - Receivable and payable aging
   - Cashflow analysis
   - Excel export (all reports)

### Key Capabilities

- **Multi-Currency:** VND, USD, RMB with client-side rate handling
- **Multi-Business-Unit:** Isolated data per operational unit (TK, NT)
- **Role-Based Access Control:** 5 roles with granular permissions, scoped per Business Unit (a user may hold different roles in TK vs NT; ADMIN is global)
- **Decimal Precision:** All monetary values use Decimal.js (no floating-point errors)
- **Audit Trail:** 100% coverage of all write operations
- **Atomicity:** All multi-step operations in database transactions
- **Excel Export:** Reports exportable to .xlsx format

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | Next.js 14+ (App Router) |
| **Language** | TypeScript |
| **Database** | PostgreSQL 14+ |
| **ORM** | Prisma 5.10+ |
| **Auth** | NextAuth.js v5 |
| **UI** | React + Tailwind CSS + shadcn/ui |
| **Validation** | zod |
| **Money** | Decimal.js |
| **Excel** | exceljs |
| **Charts** | recharts |

---

## Project Structure

```
trade-ops/
├── app/                 # Next.js App Router (pages + API routes)
├── components/          # React components (UI + business logic)
├── lib/                 # Business logic, helpers, services
├── prisma/              # Database schema, migrations, seed
├── types/               # TypeScript type definitions
├── docs/                # Complete documentation
├── plans/               # Implementation planning
└── docker-compose.yml   # Local development database
```

See `/docs/codebase-summary.md` for detailed directory structure.

---

## Documentation

- **[Project Overview & PDR](/docs/project-overview-pdr.md)** – Requirements, goals, modules, RBAC roles
- **[System Architecture](/docs/system-architecture.md)** – Tech stack, data model, API design, auth flow
- **[Code Standards](/docs/code-standards.md)** – Conventions, patterns, review checklist
- **[Codebase Summary](/docs/codebase-summary.md)** – Directory structure, file purposes
- **[Project Roadmap](/docs/project-roadmap.md)** – 13-phase implementation plan
- **[Deployment Guide](/docs/deployment-guide.md)** – Setup, configuration, production deployment

---

## Development

### Commands

```bash
# Development
npm run dev              # Start dev server (localhost:3000)
npm run build           # Build for production
npm start               # Start production server

# Database
npx prisma migrate dev  # Create + apply migration
npx prisma db seed      # Seed base data
npx prisma studio      # Open database GUI

# Code Quality
npm run type-check      # Check TypeScript
npm run lint            # Run linter
npm run format          # Format code

# Testing (Phase 13)
npm run test            # Run tests
npm run test:watch      # Watch mode
npm run test:coverage   # Coverage report
```

### Workflow

1. Create a feature branch: `git checkout -b feat/your-feature`
2. Follow code standards in `/docs/code-standards.md`
3. Commit with conventional format: `feat: add order status auto-calc`
4. Push and create pull request
5. Address review comments
6. Merge when approved

See `/docs/code-standards.md` for code review checklist.

---

## Database Management

### Local Development

**Start PostgreSQL:**
```bash
docker-compose up -d
```

**Access pgAdmin:** http://localhost:5050
- Email: admin@admin.com
- Password: admin

**Create/reset database:**
```bash
npx prisma migrate dev --name <name>  # Create migration
npx prisma migrate reset              # Reset (dev only)
npx prisma db seed                    # Seed base data
npx prisma studio                     # Open GUI
```

### Production

See `/docs/deployment-guide.md` for:
- Environment setup
- Database initialization
- Backup & recovery procedures
- Performance optimization

---

## Deployment

### Development (Local)

```bash
npm install
npm run dev
# Runs on http://localhost:3000
```

### Production (Vercel / Railway / Self-Hosted)

1. Set environment variables (see `.env.example`)
2. Run migrations: `npx prisma migrate deploy`
3. Deploy application
4. Seed base data (optional): `npx prisma db seed`

See `/docs/deployment-guide.md` for detailed instructions.

---

## Architecture Highlights

### Atomicity & Data Integrity
- All multi-step operations use `prisma.$transaction()`
- Order status auto-recalculation after every transaction
- Deposit deduction atomic with transaction creation

### Money Handling
- **No floating-point:** All monetary values use `Decimal.js`
- **No server computation:** Client computes `amountVnd` from `amountOriginal × exchangeRate`
- **Database precision:** `Decimal(18, 4)` for all money fields

### Role-Based Access Control (RBAC)
| Role | Sales | Purchases | Cashflow | Reports | Users |
|------|-------|-----------|----------|---------|-------|
| **ADMIN** | Full | Full | Full | Full | Full |
| **ACCOUNTANT_SALE** | Full | R/O | Deny | Full | Deny |
| **ACCOUNTANT_PURCHASE** | R/O | Full | Deny | Full | Deny |
| **ACCOUNTANT_CASHFLOW** | R/O | R/O | Full | Full | Deny |
| **VIEWER** | R/O | R/O | R/O | R/O | Deny |

R/O = Read-Only, Full = Create/Read/Update/Delete

### Audit Trail
- AuditLog captures every CREATE, UPDATE, DELETE
- Non-repudiation: user, action, model, record ID, timestamp, changes
- Searchable via `/api/audit-logs`

---

## API Overview

All endpoints return JSON in standard format:
```json
{
  "success": true,
  "data": { /* entity or array */ }
}
```

### Core Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/auth/callback/credentials` | Login |
| GET | `/api/orders` | List orders (sales + purchases) |
| POST | `/api/orders` | Create order |
| POST | `/api/orders/[id]/transactions` | Record payment/refund |
| GET | `/api/transactions` | List standalone receipts/payments |
| POST | `/api/transactions` | Create receipt/payment |
| GET | `/api/cashflow-report` | Cashflow summary |
| GET | `/api/reports/dashboard` | KPI cards |
| GET | `/api/reports/summary` | Sales/purchase summaries |
| GET | `/api/audit-logs` | View audit trail |

See `/docs/system-architecture.md` for complete API structure.

---

## Security

- **HTTPS:** Enforced in production
- **Authentication:** JWT sessions via NextAuth.js
- **Authorization:** Role-based access control (5 roles)
- **Password:** bcrypt hashing
- **SQL Injection:** Prisma parameterized queries
- **XSS Protection:** React auto-escapes
- **Audit Trail:** Non-repudiation logging

---

## Troubleshooting

### PostgreSQL Connection Error

```bash
docker-compose up -d          # Ensure containers running
psql -h localhost -U postgres # Test connection
```

### Migration Failed

```bash
npx prisma migrate status      # Check status
npx prisma migrate reset       # Reset (dev only)
```

### TypeScript Errors

```bash
npm run type-check             # Identify errors
# Fix following /docs/code-standards.md
```

See `/docs/deployment-guide.md` for more troubleshooting.

---

## Contributing

1. Read `/docs/code-standards.md` for conventions
2. Follow the development workflow
3. Create pull request with clear description
4. Ensure code review checklist passes
5. All tests must pass before merge

---

## Implementation Timeline

Trade Ops is organized in 13 implementation phases:

1. Environment & Setup
2. Database Schema & Migrations
3. Authentication & Authorization
4. Core API Helpers & Audit
5. Settings APIs (Config)
6. Parties & Deposits
7. Sales Orders & Payments
8. Purchase Orders & Payables
9. Standalone Transactions
10. Cashflow Reports & Excel Export
11. Summary Reports & Dashboard
12. User Management & Audit Logs
13. Integration & Performance

See `/docs/project-roadmap.md` for detailed timeline and milestones.

---

## Support & Questions

- **Documentation:** Check `/docs/` directory first
- **Code Examples:** See `/docs/codebase-summary.md` for patterns
- **Issues:** Create issue with detailed description and reproduction steps
- **Pull Requests:** Follow code standards and include tests

---

## License

Proprietary – Internal use only

---

## Version History

| Version | Date | Status |
|---------|------|--------|
| 1.0 | 2026-04-02 | Planning Phase |

