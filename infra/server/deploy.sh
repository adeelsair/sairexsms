#!/bin/bash

set -euo pipefail

TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_DIR="${BACKUP_DIR:-/opt/sairex/backups}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-7}"
POSTGRES_USER="${POSTGRES_USER:-sairex}"
POSTGRES_DB="${POSTGRES_DB:-sairex}"
BACKUP_FILE="${BACKUP_DIR}/db_${TIMESTAMP}.sql"

mkdir -p "${BACKUP_DIR}"

echo "🛡️ Creating database backup..."
docker compose exec -T db pg_dump -U "${POSTGRES_USER}" "${POSTGRES_DB}" > "${BACKUP_FILE}"
echo "💾 Backup created: ${BACKUP_FILE}"

echo "📥 Pulling latest images..."
docker compose pull

echo "🧱 Running migrations..."
docker compose run --rm migrate

echo "🚀 Starting updated services..."
docker compose up -d app worker

echo "🧹 Cleaning old images..."
docker image prune -f

echo "🗂️ Cleaning old backups (>${BACKUP_RETENTION_DAYS} days)..."
find "${BACKUP_DIR}" -type f -name "db_*.sql" -mtime +"${BACKUP_RETENTION_DAYS}" -delete

echo "✅ Deployment complete"
