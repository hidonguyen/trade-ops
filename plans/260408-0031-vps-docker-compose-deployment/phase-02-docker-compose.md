---
phase: 2
status: planned
priority: high
---

# Phase 2: Production Docker Compose

## docker-compose.prod.yml

```yaml
services:
  postgres:
    image: postgres:14-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: ${POSTGRES_DB}
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - pgdata:/var/lib/postgresql/data
    networks:
      - internal
    # No ports exposed to host — only internal network

  app:
    build: .
    restart: unless-stopped
    depends_on:
      - postgres
    environment:
      DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}?schema=public
      NEXTAUTH_URL: https://${DOMAIN}
      NEXTAUTH_SECRET: ${NEXTAUTH_SECRET}
    networks:
      - internal
    # No ports exposed — Nginx proxies to app:3000

  nginx:
    image: nginx:alpine
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/conf.d:/etc/nginx/conf.d:ro
      - certbot-etc:/etc/letsencrypt:ro
      - certbot-var:/var/lib/letsencrypt
      - webroot:/var/www/certbot
    depends_on:
      - app
    networks:
      - internal

  certbot:
    image: certbot/certbot
    volumes:
      - certbot-etc:/etc/letsencrypt
      - certbot-var:/var/lib/letsencrypt
      - webroot:/var/www/certbot
    entrypoint: "/bin/sh -c 'trap exit TERM; while :; do sleep 12h & wait $${!}; certbot renew; done'"

volumes:
  pgdata:
  certbot-etc:
  certbot-var:
  webroot:

networks:
  internal:
```

## .env.production.example

```env
# Domain
DOMAIN=trade-ops.example.com

# Database
POSTGRES_DB=trade_ops
POSTGRES_USER=trade_ops_user
POSTGRES_PASSWORD=CHANGE_ME_STRONG_PASSWORD

# NextAuth
NEXTAUTH_SECRET=CHANGE_ME_RANDOM_32_CHARS
```

## Key Design Decisions
- Postgres and app on internal-only network (no exposed ports)
- Nginx is the only public-facing service (80/443)
- Certbot runs as sidecar for auto-renewal
- All secrets via `.env.production` (not committed)

## Todo
- [ ] Create `docker-compose.prod.yml`
- [ ] Create `.env.production.example`
- [ ] Add `.env.production` to `.gitignore`
