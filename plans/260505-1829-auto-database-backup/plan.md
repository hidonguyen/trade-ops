---
title: "Auto database backup — daily + weekly cron"
description: "Bash pg_dump script + host crontab. Daily backups (7-day retention) + weekly Sunday backups (4-week retention) into local /var/backups/tradeops/."
status: completed
priority: P2
effort: 1h
branch: main
tags: [ops, backup, cron]
created: 2026-05-05
blockedBy: []
blocks: []
---

# Auto Database Backup

## Context
- DB: external Postgres on AWS Lightsail RDS (managed). DATABASE_URL in `.env.production`.
- App runs in Docker via `docker-compose.prod.yml`. DB NOT in compose.
- KISS: host crontab + bash script using `pg_dump`. No new container, no upstream service.

## Decisions (confirmed)
- Runner: cron on Docker host (the VPS running the app).
- Storage: local volume `/var/backups/tradeops/{daily,weekly}/`.
- Schedule: daily 02:00 (keep 7), weekly Sunday 03:00 (keep 4).
- Format: `pg_dump --format=custom` (.dump) — compressed, restore-friendly via `pg_restore`.

## Files
**Create:**
- `scripts/backup-db.sh` — main script
- `scripts/install-backup-cron.sh` — one-shot installer (writes cron entries, creates dirs, requires sudo for /var/backups)

**Modify:**
- `deploy.sh` — add `backup` and `restore <file>` subcommands for on-demand use
- `docs/deployment-guide.md` — document setup, restore procedure

## Script outline
```bash
#!/usr/bin/env bash
# scripts/backup-db.sh
# Usage: backup-db.sh {daily|weekly}
set -euo pipefail
TIER="${1:-daily}"
case "$TIER" in daily|weekly) ;; *) echo "tier must be daily|weekly"; exit 2;; esac

# Source DATABASE_URL from .env.production (in repo dir)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/../.env.production"
[ -f "$ENV_FILE" ] || { echo "Missing $ENV_FILE"; exit 1; }
# shellcheck disable=SC1090
DATABASE_URL=$(grep -E '^DATABASE_URL=' "$ENV_FILE" | head -1 | sed 's/^DATABASE_URL=//' | tr -d '"')
[ -n "$DATABASE_URL" ] || { echo "DATABASE_URL empty"; exit 1; }

BACKUP_DIR="/var/backups/tradeops/$TIER"
mkdir -p "$BACKUP_DIR"
TS="$(date -u +%Y%m%d-%H%M%S)"
OUT="$BACKUP_DIR/tradeops-${TIER}-${TS}.dump"

echo "[$(date -Iseconds)] Backing up to $OUT"
pg_dump --format=custom --no-owner --no-acl --dbname "$DATABASE_URL" --file "$OUT"
chmod 600 "$OUT"

# Retention prune
KEEP_DAYS=$([ "$TIER" = "daily" ] && echo 7 || echo 28)
find "$BACKUP_DIR" -name '*.dump' -type f -mtime +"$KEEP_DAYS" -delete
echo "[$(date -Iseconds)] Done. Pruned older than $KEEP_DAYS days."
```

## Crontab entries (installer adds)
```
0 2 * * *  /opt/trade-ops/scripts/backup-db.sh daily  >> /var/log/tradeops-backup.log 2>&1
0 3 * * 0  /opt/trade-ops/scripts/backup-db.sh weekly >> /var/log/tradeops-backup.log 2>&1
```

## Prereq on host
- `pg_dump` installed (`apt install postgresql-client` — version >= server major).
- `/var/backups/tradeops` writable by cron user.
- `/var/log/tradeops-backup.log` exists (logrotate optional).

## deploy.sh additions
- `./deploy.sh backup` → run script ad-hoc with tier=daily.
- `./deploy.sh restore <file>` → confirm + `pg_restore --clean --if-exists -d "$DATABASE_URL" <file>`.

## Restore procedure (docs)
```bash
# List backups
ls /var/backups/tradeops/daily/
# Restore
./deploy.sh restore /var/backups/tradeops/daily/tradeops-daily-20260505-020000.dump
```

## Phases
Single phase — output script + installer + deploy.sh updates + docs.

## Todo
- [ ] Create `scripts/backup-db.sh`
- [ ] Create `scripts/install-backup-cron.sh` (idempotent: skip if entries exist)
- [ ] Add `backup` and `restore` to `deploy.sh`
- [ ] Update `docs/deployment-guide.md` with setup + restore section
- [ ] Test locally: `pg_dump` against the local dev DB writes file
- [ ] Document on production: run installer, verify cron, run first backup manually

## Success Criteria
- Cron runs daily 02:00 + weekly Sunday 03:00 → files appear under /var/backups/tradeops/.
- Files older than 7d (daily) / 28d (weekly) auto-deleted.
- Restore command works end-to-end (test on staging).
- README documents the setup.

## Risks
- `pg_dump` version mismatch with server major version → restore may fail. Mitigation: install matching client version.
- Disk full on host → no rotation alarm. Mitigation: optional check `df -h` in script + email/log warn (defer).
- Credentials in .env.production sourced by cron → file must remain mode 600.

## Rollback
Remove cron entries + delete script files. No DB changes.

## Open Questions
- Do you want offsite copy (S3/R2) later? — Currently NO per decision. Deferred.
