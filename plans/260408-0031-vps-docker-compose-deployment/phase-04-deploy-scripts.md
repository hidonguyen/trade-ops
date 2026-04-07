---
phase: 4
status: planned
priority: medium
---

# Phase 4: Deploy Scripts + Documentation

## deploy.sh

Single script for first-time setup and updates:

```bash
#!/bin/bash
set -e

# Usage: ./deploy.sh [init|update|ssl]

case "${1:-update}" in
  init)
    # First-time setup
    echo "=== Initial deployment ==="
    cp .env.production.example .env.production
    echo "Edit .env.production with your values, then run: ./deploy.sh ssl"
    ;;
  ssl)
    # Obtain SSL certificate
    echo "=== Obtaining SSL certificate ==="
    source .env.production
    docker compose -f docker-compose.prod.yml up -d nginx
    docker compose -f docker-compose.prod.yml run --rm certbot \
      certonly --webroot -w /var/www/certbot -d $DOMAIN --email admin@$DOMAIN --agree-tos --no-eff-email
    # Switch to SSL config
    cp nginx/conf.d/app.conf.ssl nginx/conf.d/app.conf
    sed -i "s/\${DOMAIN}/$DOMAIN/g" nginx/conf.d/app.conf
    docker compose -f docker-compose.prod.yml up -d --build
    echo "=== SSL setup complete ==="
    ;;
  update)
    # Regular update (pull + rebuild + migrate)
    echo "=== Updating ==="
    git pull origin main
    docker compose -f docker-compose.prod.yml up -d --build app
    docker compose -f docker-compose.prod.yml exec app npx prisma migrate deploy
    docker compose -f docker-compose.prod.yml exec nginx nginx -s reload
    echo "=== Update complete ==="
    ;;
esac
```

## VPS Prerequisites (document in README or docs)
- Docker + Docker Compose installed
- Domain DNS A record pointing to VPS IP
- Port 80 and 443 open in firewall
- Git installed (for pulling updates)

## Deployment Steps (first time)
1. SSH into VPS
2. Clone repo: `git clone <repo-url> && cd trade-ops`
3. Run: `./deploy.sh init`
4. Edit `.env.production` with real values
5. Run: `./deploy.sh ssl`
6. Seed database: `docker compose -f docker-compose.prod.yml exec app npx prisma db seed`

## Updating
```bash
./deploy.sh update
```

## Todo
- [ ] Create `deploy.sh`
- [ ] Add deployment docs to `docs/deployment-guide.md`
- [ ] Add `.env.production` to `.gitignore`
