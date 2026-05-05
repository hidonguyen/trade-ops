#!/usr/bin/env bash
# Idempotent installer: ensures backup dirs exist + crontab entries for daily/weekly backups.
# Run on the production host as the user that owns the repo (typically with sudo for /var/backups).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_SCRIPT="$SCRIPT_DIR/backup-db.sh"
[ -x "$BACKUP_SCRIPT" ] || chmod +x "$BACKUP_SCRIPT"

LOG_FILE="/var/log/tradeops-backup.log"

# Create backup dirs (needs sudo if /var/backups not writable by current user)
sudo mkdir -p /var/backups/tradeops/daily /var/backups/tradeops/weekly
sudo touch "$LOG_FILE"
sudo chown "$(id -u):$(id -g)" /var/backups/tradeops /var/backups/tradeops/daily /var/backups/tradeops/weekly "$LOG_FILE"

# Idempotent crontab append: skip if entry already present (matched by script path + tier)
TMP=$(mktemp)
crontab -l 2>/dev/null > "$TMP" || true

ENTRY_DAILY="0 2 * * *  $BACKUP_SCRIPT daily  >> $LOG_FILE 2>&1"
ENTRY_WEEKLY="0 3 * * 0  $BACKUP_SCRIPT weekly >> $LOG_FILE 2>&1"

grep -Fq "$BACKUP_SCRIPT daily"  "$TMP" || echo "$ENTRY_DAILY"  >> "$TMP"
grep -Fq "$BACKUP_SCRIPT weekly" "$TMP" || echo "$ENTRY_WEEKLY" >> "$TMP"

crontab "$TMP"
rm -f "$TMP"

echo "Installed cron entries:"
crontab -l | grep "$BACKUP_SCRIPT"
echo
echo "Log file: $LOG_FILE"
echo "Backups : /var/backups/tradeops/{daily,weekly}/"
echo
echo "Run a manual backup now: $BACKUP_SCRIPT daily"
