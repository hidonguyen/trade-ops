#!/usr/bin/env bash
# Postgres backup → /var/backups/tradeops/{daily,weekly}/. Auto-prunes older files.
# Usage: backup-db.sh {daily|weekly}
set -euo pipefail

TIER="${1:-daily}"
case "$TIER" in
  daily)  KEEP_DAYS=7 ;;
  weekly) KEEP_DAYS=28 ;;
  *) echo "tier must be daily|weekly" >&2; exit 2 ;;
esac

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/../.env.production"
[ -f "$ENV_FILE" ] || { echo "Missing $ENV_FILE" >&2; exit 1; }

DATABASE_URL=$(grep -E '^DATABASE_URL=' "$ENV_FILE" | head -1 | sed 's/^DATABASE_URL=//' | tr -d '"')
[ -n "$DATABASE_URL" ] || { echo "DATABASE_URL empty in $ENV_FILE" >&2; exit 1; }

BACKUP_DIR="/var/backups/tradeops/$TIER"
mkdir -p "$BACKUP_DIR"
TS="$(date -u +%Y%m%d-%H%M%S)"
OUT="$BACKUP_DIR/tradeops-${TIER}-${TS}.dump"

echo "[$(date -Iseconds)] Backing up to $OUT (tier=$TIER)"
pg_dump --format=custom --no-owner --no-acl --dbname "$DATABASE_URL" --file "$OUT"
chmod 600 "$OUT"

# Retention prune
DELETED=$(find "$BACKUP_DIR" -name '*.dump' -type f -mtime +"$KEEP_DAYS" -print -delete | wc -l | tr -d ' ')
echo "[$(date -Iseconds)] Done. Pruned $DELETED file(s) older than $KEEP_DAYS days."
