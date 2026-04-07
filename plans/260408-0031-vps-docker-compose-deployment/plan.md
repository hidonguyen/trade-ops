---
status: planned
priority: high
complexity: moderate
blockedBy: []
blocks: []
---

# VPS Deployment — Docker Compose + Nginx + Let's Encrypt

Deploy Trade Ops (Next.js 16 + Prisma + PostgreSQL) to VPS using Docker Compose with Nginx reverse proxy and auto-renewing SSL via Let's Encrypt.

## Current State
- **docker-compose.yml**: Dev-only (Postgres + pgAdmin), no app container
- **No Dockerfile** exists
- **No Nginx config** exists
- **Env vars**: `DATABASE_URL`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET`
- **Next.js 16** with `next build` + `next start` (port 3000)
- **Prisma 7** with PostgreSQL adapter

## Target Architecture

```
Internet → :443 (Nginx + SSL) → :3000 (Next.js app)
                                      ↓
                              :5432 (PostgreSQL)
```

**Docker Compose services:**
1. `app` — Next.js production build (multi-stage Dockerfile)
2. `postgres` — PostgreSQL 14 with persistent volume
3. `nginx` — Reverse proxy with Let's Encrypt SSL (certbot)

## Phases

| # | Phase | Status | Files |
|---|-------|--------|-------|
| 1 | [Dockerfile + next.config](phase-01-dockerfile.md) | planned | `Dockerfile`, `next.config.ts`, `.dockerignore` |
| 2 | [Production Docker Compose](phase-02-docker-compose.md) | planned | `docker-compose.prod.yml`, `.env.production.example` |
| 3 | [Nginx + SSL](phase-03-nginx-ssl.md) | planned | `nginx/`, certbot setup |
| 4 | [Deploy scripts](phase-04-deploy-scripts.md) | planned | `deploy.sh`, docs |
