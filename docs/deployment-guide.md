# Deployment Guide – Trade Ops
## Setup, Configuration, Deployment Procedures

**Status:** Planning Phase
**Last Updated:** 2026-04-02
**Version:** 1.0

---

## Overview

This guide covers local development setup, staging configuration, production deployment, and operational procedures for Trade Ops.

---

## Local Development Setup

### Prerequisites

- **Node.js:** 18+ (verify with `node -v`)
- **npm:** 9+ (verify with `npm -v`)
- **Docker:** 20+ (verify with `docker --version`)
- **Git:** Latest (verify with `git --version`)

### Step 1: Clone Repository

```bash
git clone https://github.com/your-org/trade-ops.git
cd trade-ops
```

### Step 2: Install Dependencies

```bash
npm install
```

### Step 3: Environment Setup

Copy the example env file and populate with local values:

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/trade_ops_dev"

# NextAuth.js
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key-min-32-chars"

# Node environment
NODE_ENV="development"
```

**Generating NEXTAUTH_SECRET:**
```bash
openssl rand -base64 32
```

### Step 4: Start PostgreSQL

```bash
docker-compose up -d
```

Verify PostgreSQL is running:
```bash
docker ps  # Should show postgres container
psql -h localhost -U postgres -c "SELECT version();"
```

**pgAdmin Access:** http://localhost:5050
- Email: admin@admin.com
- Password: admin

### Step 5: Initialize Database

```bash
# Create schema from Prisma
npx prisma migrate dev --name init

# Seed base data (admin user, business units, currencies)
npx prisma db seed
```

**Verify data:**
```bash
npx prisma studio  # Opens GUI at http://localhost:5555
```

### Step 6: Start Development Server

```bash
npm run dev
```

Server runs at: http://localhost:3000

**Login with seeded credentials:**
- Email: admin@example.com
- Password: (check `prisma/seed.ts` for hashed password setup)

### Step 7: Verify Setup

- [ ] Login page accessible at http://localhost:3000
- [ ] Dashboard loads after login
- [ ] Prisma Studio shows all tables populated
- [ ] TypeScript compilation: `npm run build` succeeds

---

## Development Workflow

### Running Tests

(Tests implementation added in Phase 13)

```bash
npm run test
npm run test:watch
npm run test:coverage
```

### Type Checking

```bash
npm run type-check
```

### Code Linting

```bash
npm run lint
npm run lint:fix
```

### Building for Production

```bash
npm run build
```

Verify no TypeScript errors:
```bash
npm run type-check
```

### Formatting

```bash
npm run format
```

---

## Environment Variables

### Required Variables

| Variable | Example | Purpose |
|----------|---------|---------|
| `DATABASE_URL` | `postgresql://user:pass@localhost:5432/db` | PostgreSQL connection |
| `NEXTAUTH_URL` | `http://localhost:3000` (dev) or `https://app.example.com` (prod) | Auth redirect URI |
| `NEXTAUTH_SECRET` | `<32-char random string>` | JWT signing key |
| `NODE_ENV` | `development` or `production` | Runtime environment |

### Optional Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `LOG_LEVEL` | `info` | Logging verbosity |
| `API_TIMEOUT_MS` | `30000` | Request timeout |
| `MAX_EXPORT_ROWS` | `100000` | Excel export limit |

### Development Only

```env
# Skip in production
NEXTAUTH_URL=http://localhost:3000
NODE_ENV=development
```

---

## Database Management

### Migrations

**Create new migration:**
```bash
npx prisma migrate dev --name <descriptive-name>
```

Example: `npx prisma migrate dev --name add_expense_types`

**Apply migrations (production):**
```bash
npx prisma migrate deploy
```

**Reset database (dev only):**
```bash
npx prisma migrate reset
# Confirms deletion, re-runs all migrations, re-seeds
```

**View migration history:**
```bash
npx prisma migrate status
```

### Seeding

**Run seed script:**
```bash
npx prisma db seed
```

**Seed file location:** `prisma/seed.ts`

**Typical seed creates:**
- Admin user (email: admin@example.com, password: hashed)
- Business units (TK, NT)
- Currencies (VND, USD, RMB)
- Expense types (Utilities, Salary, Rent, etc.)

### Backup & Restore

**Backup database:**
```bash
pg_dump -h localhost -U postgres trade_ops_dev > backup_$(date +%Y%m%d).sql
```

**Restore database:**
```bash
psql -h localhost -U postgres trade_ops_dev < backup_20260402.sql
```

---

## Deployment to Production

### Prerequisites

- PostgreSQL database (managed or self-hosted)
- Node.js 18+ runtime environment (Vercel, Railway, etc.)
- Environment variables configured in deployment platform

### Option 1: Vercel (Recommended)

**Setup:**
1. Push code to GitHub
2. Create project at https://vercel.com
3. Import repository
4. Configure environment variables in Settings → Environment Variables
5. Deploy

**Environment Variables (Vercel):**
```
DATABASE_URL=postgresql://user:pass@...
NEXTAUTH_URL=https://your-domain.com
NEXTAUTH_SECRET=<32-char key>
NODE_ENV=production
```

**Deploy:**
```bash
# Automatic on git push to main
# Or manual via Vercel dashboard
```

**Post-Deploy:**
```bash
# Run migrations (one-time)
npx prisma migrate deploy

# Verify deployment
curl https://your-domain.com
```

### Option 2: Railway

**Setup:**
1. Create Railway project
2. Add PostgreSQL plugin
3. Deploy from GitHub
4. Configure environment variables

**Deploy:**
```bash
railway up
```

### Option 3: Self-Hosted (Linux/Docker)

**Docker Build:**
```dockerfile
# Dockerfile
FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Build application
COPY . .
RUN npm run build

# Expose port
EXPOSE 3000

# Run migrations & start
CMD ["sh", "-c", "npx prisma migrate deploy && npm start"]
```

**Build & Run:**
```bash
docker build -t trade-ops:latest .

docker run \
  -e DATABASE_URL="postgresql://..." \
  -e NEXTAUTH_URL="https://your-domain.com" \
  -e NEXTAUTH_SECRET="<key>" \
  -p 3000:80 \
  trade-ops:latest
```

### Environment Variables (Production)

```bash
# .env (production server)
DATABASE_URL="postgresql://user:password@your-db-host:5432/trade_ops"
NEXTAUTH_URL="https://your-production-domain.com"
NEXTAUTH_SECRET="your-32-character-secret-key"
NODE_ENV="production"
```

### Database Setup (Production)

**Create PostgreSQL database:**
```bash
createdb -h your-db-host -U postgres trade_ops
```

**Run migrations:**
```bash
export DATABASE_URL="postgresql://user:pass@host:5432/trade_ops"
npx prisma migrate deploy
```

**Seed base data (optional):**
```bash
npx prisma db seed
```

---

## Monitoring & Maintenance

### Health Checks

**API health endpoint** (to implement):
```bash
GET /api/health
```

Should return:
```json
{
  "status": "ok",
  "database": "connected",
  "timestamp": "2026-04-02T10:00:00Z"
}
```

### Logging

**Application logs:**
```bash
# Vercel
vercel logs <project-name>

# Railway
railway logs

# Docker
docker logs <container-id>
```

**Database logs:**
```bash
# PostgreSQL query logs (slow queries)
sudo tail -f /var/log/postgresql/postgresql.log
```

### Performance Monitoring

**Query performance:**
```sql
-- Find slow queries (Postgres)
SELECT query, calls, mean_time, max_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;
```

**API response times:**
- Monitor with application performance monitoring (APM) tool
- Vercel Analytics: https://vercel.com/analytics
- DataDog, New Relic, or similar

### Database Maintenance

**Weekly:**
```bash
# Analyze query planner statistics
ANALYZE;

# Reindex tables (if needed)
REINDEX DATABASE trade_ops;
```

**Monthly:**
```bash
# Vacuum and clean (maintenance)
VACUUM FULL ANALYZE;
```

---

## Troubleshooting

### Common Issues

#### PostgreSQL Connection Failed

**Error:**
```
Error: connect ECONNREFUSED 127.0.0.1:5432
```

**Solution:**
```bash
# Check if PostgreSQL is running
docker ps | grep postgres

# Restart if stopped
docker-compose up -d

# Verify connection
psql -h localhost -U postgres -c "SELECT 1"
```

#### Migration Failed

**Error:**
```
Error: P1009 - Failed to fetch migrations
```

**Solution:**
```bash
# Check migration file syntax
npx prisma migrate status

# Reset and re-run (dev only)
npx prisma migrate reset

# For production, check migrations/ directory for errors
ls prisma/migrations/
```

#### NextAuth Secret Missing

**Error:**
```
Error: NEXTAUTH_SECRET not configured
```

**Solution:**
```bash
# Generate new secret
openssl rand -base64 32

# Add to .env.local
echo "NEXTAUTH_SECRET=<generated-value>" >> .env.local
```

#### TypeScript Build Errors

**Error:**
```
error TS7053: Element implicitly has an 'any' type
```

**Solution:**
```bash
# Fix TypeScript errors
npm run type-check

# Review and add explicit types
# Check /docs/code-standards.md for patterns
```

#### Slow Queries

**Diagnose:**
```sql
-- Enable slow query log
ALTER SYSTEM SET log_min_duration_statement = 1000;
SELECT pg_reload_conf();

-- Check slow queries
SELECT query, calls, mean_time
FROM pg_stat_statements
ORDER BY mean_time DESC LIMIT 10;
```

**Fix:**
```sql
-- Add indexes on frequently filtered columns
CREATE INDEX idx_orders_business_unit_id 
ON orders(business_unit_id);

CREATE INDEX idx_transactions_order_id 
ON transactions(order_id);
```

---

## Backup & Disaster Recovery

### Backup Strategy

**Automated Backups:**
- Managed PostgreSQL (Vercel, Railway): automatic daily backups
- Self-hosted: Set up pg_dump cron job

**Manual Backup:**
```bash
pg_dump -h localhost -U postgres trade_ops > backup_$(date +%Y%m%d_%H%M%S).sql
```

**Backup Location:** Secure cloud storage (AWS S3, Google Cloud Storage)

### Restore Procedure

1. **Verify backup integrity:**
   ```bash
   pg_restore -h localhost -U postgres -C -d postgres backup_20260402.sql
   ```

2. **Test restore in staging environment first**

3. **Restore in production:**
   ```bash
   psql -h prod-db-host -U postgres trade_ops < backup_20260402.sql
   ```

4. **Verify data integrity:**
   ```bash
   SELECT COUNT(*) FROM orders;
   SELECT COUNT(*) FROM transactions;
   ```

---

## Scaling & Performance Tuning

### Database Optimization

**Connection pooling:**
```env
# Use PgBouncer for connection pooling
DATABASE_URL="postgresql://user:pass@pgbouncer:6432/trade_ops"
```

**Index optimization:**
- Review `/docs/system-architecture.md` for recommended indexes
- Use `EXPLAIN ANALYZE` to verify index usage

**Query optimization:**
- Avoid N+1 queries (use Prisma `include` carefully)
- Use `select` to fetch only needed columns
- Add pagination to large result sets

### Application Scaling

**Horizontal scaling:**
- Deploy multiple instances behind load balancer
- Share PostgreSQL database
- Use Redis for session store (optional, if needed)

**Vertical scaling:**
- Increase Node.js memory allocation
- Upgrade PostgreSQL hardware (RAM, CPU)
- Consider managed database service

### Monitoring Performance

**Metrics to track:**
- API response time (target <500ms p95)
- Database query time (target <100ms p95)
- Error rate (target <0.1%)
- Memory usage (alert >80%)

---

## Security Checklist

Before deploying to production:

- [ ] `NEXTAUTH_SECRET` is 32+ random characters
- [ ] `NEXTAUTH_URL` matches production domain
- [ ] Database password is strong (20+ chars, mixed case, symbols)
- [ ] PostgreSQL only accepts connections from app server (firewall rules)
- [ ] HTTPS enforced on all routes
- [ ] CORS configured for same-origin only
- [ ] No `.env.local` or secrets in git
- [ ] SQL injection prevention verified (Prisma parameterized)
- [ ] XSS protection verified (React auto-escapes)
- [ ] CSRF tokens enabled (NextAuth handles)
- [ ] Rate limiting configured on sensitive endpoints
- [ ] Audit logs enabled and monitored
- [ ] Regular backups tested and verified

---

## Operations Runbook

### Daily

- Monitor error logs
- Check API response times
- Verify backups completed

### Weekly

- Review slow query logs
- Analyze database performance
- Check disk space usage

### Monthly

- Vacuum database
- Reindex tables
- Review audit logs (compliance)
- Update dependencies (npm audit)

### Quarterly

- Performance benchmarks
- Security audit
- Disaster recovery test

---

## Rollback Procedure

If deployment causes issues:

**Vercel:**
```bash
# Revert to previous deployment
vercel rollback
```

**Railway:**
```bash
# Redeploy previous version
railway deploy <previous-hash>
```

**Manual:**
```bash
# Rollback database migrations (if applicable)
npx prisma migrate resolve --rolled-back 20260402000000_migration_name

# Redeploy previous code version
git revert <bad-commit>
git push
```

---

## Related Documentation

- `/docs/project-overview-pdr.md` – Project requirements
- `/docs/system-architecture.md` – Technical architecture
- `/docs/code-standards.md` – Development standards
- `README.md` – Quick start guide

