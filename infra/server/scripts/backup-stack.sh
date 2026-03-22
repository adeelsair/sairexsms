#!/usr/bin/env bash
#
# SairexSMS — full stack backup (Postgres + Redis data + config snapshots).
# Safe for Docker Compose production layout (container names sairex_db / sairex_redis).
#
# Does NOT use pg_dumpall against wrong users; matches deploy-safe.sh (single DB SQL).
#
# Usage:
#   SAIREX_REPO=/home/sairex/SairexSMS ./backup-stack.sh
#
# Optional:
#   BACKUP_ROOT=~/sairex-stack-backups   (default)
#   RETENTION_DAYS=14
#   RCLONE_REMOTE_PATH=remote:bucket/sairex   (after `rclone config`)
#   SAIREX_UPLOADS_PATH=/path/to/host/uploads  (if you bind-mount uploads later)
#
set -euo pipefail

SAIREX_REPO="${SAIREX_REPO:-${HOME}/SairexSMS}"
BACKUP_ROOT="${BACKUP_ROOT:-${HOME}/sairex-stack-backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"

DB_CONTAINER="${DB_CONTAINER:-sairex_db}"
REDIS_CONTAINER="${REDIS_CONTAINER:-sairex_redis}"
POSTGRES_USER="${POSTGRES_USER:-sairex}"
POSTGRES_DB="${POSTGRES_DB:-sairex}"

STAMP="$(date +%Y%m%d_%H%M%S)"
WORKDIR_NAME="work-${STAMP}"
WORKDIR="${BACKUP_ROOT}/${WORKDIR_NAME}"
ARCHIVE="${BACKUP_ROOT}/sairex-stack-${STAMP}.tar.gz"

log() { echo "[backup-stack] $*"; }

if ! docker info >/dev/null 2>&1; then
  echo "[backup-stack] ERROR: docker not available" >&2
  exit 1
fi

mkdir -p "${BACKUP_ROOT}"
mkdir -p "${WORKDIR}"

log "Work dir: ${WORKDIR}"

{
  echo "STAMP=${STAMP}"
  echo "HOST=$(hostname 2>/dev/null || true)"
  echo "SAIREX_REPO=${SAIREX_REPO}"
  date -Iseconds 2>/dev/null || date
  echo "--- docker ps ---"
  docker ps --format '{{.Names}}\t{{.Status}}' 2>/dev/null || true
} >"${WORKDIR}/MANIFEST.txt"

if ! docker inspect "${DB_CONTAINER}" >/dev/null 2>&1; then
  echo "[backup-stack] ERROR: container ${DB_CONTAINER} not found" >&2
  exit 1
fi

log "Dumping PostgreSQL (${POSTGRES_DB})…"
# Note: omit `docker exec -T` — older Docker engines on some VPS images reject `-T`.
docker exec "${DB_CONTAINER}" pg_dump -U "${POSTGRES_USER}" "${POSTGRES_DB}" >"${WORKDIR}/postgres.sql"

if [[ -n "${SAIREX_UPLOADS_PATH:-}" ]] && [[ -d "${SAIREX_UPLOADS_PATH}" ]]; then
  log "Archiving uploads from ${SAIREX_UPLOADS_PATH}…"
  tar -czf "${WORKDIR}/uploads.tgz" -C "$(dirname "${SAIREX_UPLOADS_PATH}")" "$(basename "${SAIREX_UPLOADS_PATH}")"
fi

if docker inspect "${REDIS_CONTAINER}" >/dev/null 2>&1; then
  log "Syncing Redis to disk (SAVE)…"
  docker exec "${REDIS_CONTAINER}" redis-cli SAVE >/dev/null 2>&1 || log "WARN: redis SAVE failed (continuing)"
  mkdir -p "${WORKDIR}/redis-data"
  log "Copying Redis /data …"
  docker cp "${REDIS_CONTAINER}:/data/." "${WORKDIR}/redis-data/" || log "WARN: redis docker cp failed"
else
  log "WARN: ${REDIS_CONTAINER} not found; skipping Redis"
fi

log "Copying config templates from repo…"
mkdir -p "${WORKDIR}/config"
for rel in infra/server/server.env.live infra/server/.env infra/server/docker-compose.prod.yml; do
  src="${SAIREX_REPO}/${rel}"
  if [[ -f "${src}" ]]; then
    install -D -m 0600 "${src}" "${WORKDIR}/config/${rel}"
  fi
done

if [[ ! -s "${WORKDIR}/postgres.sql" ]]; then
  echo "[backup-stack] ERROR: postgres.sql is empty" >&2
  rm -rf "${WORKDIR}"
  exit 1
fi

log "Compressing archive…"
parent="$(dirname "${WORKDIR}")"
base="$(basename "${WORKDIR}")"
tar -czf "${ARCHIVE}" -C "${parent}" "${base}"
rm -rf "${WORKDIR}"

chmod 600 "${ARCHIVE}" 2>/dev/null || true

log "Archive: ${ARCHIVE} ($(du -h "${ARCHIVE}" | cut -f1))"

find "${BACKUP_ROOT}" -maxdepth 1 -type f -name 'sairex-stack-*.tar.gz' -mtime +"${RETENTION_DAYS}" -delete || true
log "Retention: removed archives older than ${RETENTION_DAYS} days"

if [[ -n "${RCLONE_REMOTE_PATH:-}" ]]; then
  if command -v rclone >/dev/null 2>&1; then
    log "rclone copy → ${RCLONE_REMOTE_PATH}"
    rclone copy "${ARCHIVE}" "${RCLONE_REMOTE_PATH}" || log "WARN: rclone copy failed"
  else
    log "WARN: RCLONE_REMOTE_PATH set but rclone not installed"
  fi
fi

log "Done."
