#!/usr/bin/env bash
#
# SairexSMS — restore from backup-stack archive (DISRUPTIVE).
#
# Stops app workers, restores Postgres from postgres.sql, restores Redis /data, prints config paths.
#
# Usage:
#   CONFIRM=YES_I_WILL_LOSE_CURRENT_DATA SAIREX_REPO=/home/sairex/SairexSMS \
#     ./restore-stack.sh /path/to/sairex-stack-YYYYMMDD_HHMMSS.tar.gz
#
set -euo pipefail

ARCHIVE="${1:-}"
if [[ -z "${ARCHIVE}" ]] || [[ ! -f "${ARCHIVE}" ]]; then
  echo "Usage: CONFIRM=YES_I_WILL_LOSE_CURRENT_DATA FRESH_DATABASE_RESTORE=true $0 /path/to/sairex-stack-*.tar.gz" >&2
  exit 1
fi

if [[ "${CONFIRM:-}" != "YES_I_WILL_LOSE_CURRENT_DATA" ]]; then
  echo "Refusing: set CONFIRM=YES_I_WILL_LOSE_CURRENT_DATA to proceed." >&2
  echo "This overwrites live DB + Redis data for containers sairex_db / sairex_redis." >&2
  exit 1
fi

if [[ "${FRESH_DATABASE_RESTORE:-}" != "true" ]]; then
  echo "Refusing: set FRESH_DATABASE_RESTORE=true to replace the entire Postgres database." >&2
  echo "pg_dump output cannot be reapplied cleanly onto a non-empty DB without DROP/CREATE." >&2
  exit 1
fi

DB_CONTAINER="${DB_CONTAINER:-sairex_db}"
REDIS_CONTAINER="${REDIS_CONTAINER:-sairex_redis}"
POSTGRES_USER="${POSTGRES_USER:-sairex}"
POSTGRES_DB="${POSTGRES_DB:-sairex}"

SAIREX_REPO="${SAIREX_REPO:-${HOME}/SairexSMS}"

log() { echo "[restore-stack] $*"; }

TMP="$(mktemp -d)"
trap 'rm -rf "${TMP}"' EXIT

log "Extracting ${ARCHIVE}…"
tar -xzf "${ARCHIVE}" -C "${TMP}"
EXTRACT="$(find "${TMP}" -maxdepth 1 -mindepth 1 -type d | head -1)"
if [[ -z "${EXTRACT}" ]]; then
  echo "[restore-stack] ERROR: could not find extracted directory" >&2
  exit 1
fi

SQL_FILE="${EXTRACT}/postgres.sql"
if [[ ! -f "${SQL_FILE}" ]]; then
  echo "[restore-stack] ERROR: missing postgres.sql in archive" >&2
  exit 1
fi

log "Stopping app writers (best-effort)…"
for c in sairex_app sairex_worker sairex_sms_worker; do
  docker stop "${c}" 2>/dev/null || true
done

log "Recreating Postgres database ${POSTGRES_DB} (terminates other sessions)…"
docker exec -i "${DB_CONTAINER}" psql -U "${POSTGRES_USER}" -d postgres -v ON_ERROR_STOP=1 <<EOSQL
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = '${POSTGRES_DB}' AND pid <> pg_backend_pid();
DROP DATABASE IF EXISTS ${POSTGRES_DB};
CREATE DATABASE ${POSTGRES_DB};
EOSQL

log "Loading postgres.sql…"
docker exec -i "${DB_CONTAINER}" psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -v ON_ERROR_STOP=1 <"${SQL_FILE}"

if [[ -d "${EXTRACT}/redis-data" ]] && docker inspect "${REDIS_CONTAINER}" >/dev/null 2>&1; then
  log "Stopping Redis for file restore…"
  docker stop "${REDIS_CONTAINER}" >/dev/null
  log "Copying Redis data…"
  docker cp "${EXTRACT}/redis-data/." "${REDIS_CONTAINER}:/data/"
  log "Starting Redis…"
  docker start "${REDIS_CONTAINER}" >/dev/null
else
  log "Skipping Redis (no redis-data in archive or container missing)"
fi

if [[ -d "${EXTRACT}/config" ]]; then
  log "Config snapshot in archive — copy manually after review (secrets!):"
  find "${EXTRACT}/config" -type f -print | sed 's/^/  /'
  log "Example:"
  echo "  cp ${EXTRACT}/config/infra/server/server.env.live ${SAIREX_REPO}/infra/server/   # only if intended"
fi

log "Starting application containers (best-effort)…"
for c in sairex_redis sairex_db sairex_worker sairex_sms_worker sairex_app; do
  docker start "${c}" 2>/dev/null || true
done

log "Done. Verify: curl -sS https://your-app/api/health"
log "If restore failed mid-flight, restore from another archive or redeploy."
