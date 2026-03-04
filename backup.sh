#!/bin/bash

# ─── SairexSMS Database Backup Script ─────────────────────────────────────────
# Usage: bash backup.sh [optional_label]
# Example: bash backup.sh before_org_migration

DB_NAME="sairex_db"
DB_USER="postgres"
DB_HOST="localhost"
DB_PORT="5432"

BACKUP_DIR="./backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
LABEL="${1:-manual}"
FILENAME="${BACKUP_DIR}/${DB_NAME}_${LABEL}_${TIMESTAMP}.dump"

mkdir -p "$BACKUP_DIR"

echo "──────────────────────────────────────────────"
echo "  SairexSMS Database Backup"
echo "──────────────────────────────────────────────"
echo "  Database : $DB_NAME"
echo "  Host     : $DB_HOST:$DB_PORT"
echo "  Output   : $FILENAME"
echo "──────────────────────────────────────────────"

PGPASSWORD="Sair@1973" pg_dump \
  -U "$DB_USER" \
  -h "$DB_HOST" \
  -p "$DB_PORT" \
  -d "$DB_NAME" \
  -F c \
  -f "$FILENAME"

if [ $? -eq 0 ]; then
  SIZE=$(du -h "$FILENAME" | cut -f1)
  echo ""
  echo "  Backup successful! ($SIZE)"
  echo "  File: $FILENAME"
  echo ""
  echo "  To restore:"
  echo "    pg_restore -U $DB_USER -h $DB_HOST -d $DB_NAME -c $FILENAME"
  echo "──────────────────────────────────────────────"
else
  echo ""
  echo "  Backup FAILED. Check credentials and that PostgreSQL is running."
  echo "──────────────────────────────────────────────"
  exit 1
fi
