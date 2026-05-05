#!/bin/bash
set -e

COMPOSE="docker compose -f docker-compose.prod.yml"

case "${1:-help}" in
  init)
    echo "=== Initial setup ==="
    if [ ! -f .env.production ]; then
      cp .env.production.example .env.production
      echo "Created .env.production — edit it with your values, then run:"
      echo "  ./deploy.sh start"
    else
      echo ".env.production already exists"
    fi
    ;;

  start)
    echo "=== Starting services ==="
    source .env.production
    $COMPOSE up -d --build
    sleep 3
    $COMPOSE exec app npx prisma migrate deploy
    echo "=== App running at http://$DOMAIN ==="
    ;;

  ssl)
    echo "=== Obtaining SSL certificate ==="
    source .env.production
    $COMPOSE run --rm certbot certonly \
      --webroot -w /var/www/certbot \
      -d "$DOMAIN" \
      --email "admin@$DOMAIN" \
      --agree-tos --no-eff-email
    # Switch to SSL nginx config
    cp nginx/conf.d/app.conf.ssl nginx/conf.d/app.conf
    sed -i "s/$DOMAIN/g" nginx/conf.d/app.conf
    $COMPOSE exec nginx nginx -s reload
    echo "=== SSL enabled at https://$DOMAIN ==="
    ;;

  update)
    echo "=== Updating ==="
    git pull origin main
    $COMPOSE up -d --build app
    $COMPOSE exec app npx prisma migrate deploy
    $COMPOSE exec nginx nginx -s reload
    echo "=== Update complete ==="
    ;;

  seed)
    echo "=== Seeding database ==="
    $COMPOSE exec app npx prisma db seed
    echo "=== Seed complete ==="
    ;;

  logs)
    $COMPOSE logs -f "${2:-app}"
    ;;

  stop)
    $COMPOSE down
    ;;

  backup)
    echo "=== Running on-demand database backup ==="
    "$(dirname "$0")/scripts/backup-db.sh" "${2:-daily}"
    ;;

  restore)
    FILE="${2:-}"
    if [ -z "$FILE" ] || [ ! -f "$FILE" ]; then
      echo "Usage: ./deploy.sh restore <path-to-dump-file>"
      echo "Available backups:"
      ls -lh /var/backups/tradeops/daily/ /var/backups/tradeops/weekly/ 2>/dev/null || echo "  (no backups found)"
      exit 1
    fi
    read -r -p "Restoring $FILE will OVERWRITE the current database. Type YES to continue: " CONFIRM
    [ "$CONFIRM" = "YES" ] || { echo "Cancelled."; exit 1; }
    source .env.production
    pg_restore --clean --if-exists --no-owner --no-acl --dbname "$DATABASE_URL" "$FILE"
    echo "=== Restore complete ==="
    ;;

  *)
    echo "Usage: ./deploy.sh [command]"
    echo ""
    echo "Commands:"
    echo "  init             Create .env.production from template"
    echo "  start            Build and start all services + run migrations"
    echo "  ssl              Obtain Let's Encrypt SSL certificate"
    echo "  update           Pull latest code, rebuild app, run migrations"
    echo "  seed             Seed the database"
    echo "  logs             View logs (default: app, or specify service)"
    echo "  stop             Stop all services"
    echo "  backup [tier]    Run pg_dump backup now (tier: daily|weekly, default daily)"
    echo "  restore <file>   Restore database from a .dump file (DESTRUCTIVE)"
    ;;
esac
