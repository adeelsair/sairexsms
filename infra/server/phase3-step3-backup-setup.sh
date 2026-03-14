#!/bin/bash
set -euo pipefail

mkdir -p /home/sairex/backups

cat > /home/sairex/backup_sairex.sh <<'EOF'
#!/bin/bash
set -euo pipefail

BACKUP_DIR="$HOME/backups"
DATE=$(date +%F)
OUT_FILE="$BACKUP_DIR/sairex_$DATE.sql"

mkdir -p "$BACKUP_DIR"

# Dockerized Postgres dump (matches current production stack)
docker exec sairex_db pg_dump -U sairex -d sairex > "$OUT_FILE"

# Keep last 14 days
find "$BACKUP_DIR" -type f -name 'sairex_*.sql' -mtime +14 -delete
EOF

chmod +x /home/sairex/backup_sairex.sh
/home/sairex/backup_sairex.sh

# Idempotent cron install for sairex user
( crontab -l 2>/dev/null | grep -v 'backup_sairex.sh' || true; echo '0 2 * * * /home/sairex/backup_sairex.sh' ) | crontab -

echo '--- HOME LIST ---'
ls -1 /home/sairex | sed -n '1,80p'
echo '--- BACKUPS ---'
ls -lh /home/sairex/backups | sed -n '1,80p'
echo '--- CRON ---'
crontab -l
