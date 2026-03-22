#!/usr/bin/env bash
#
# SairexSMS — full stack backup (Postgres + Redis data + config snapshots).
# Safe for Docker Compose production layout (container names sairex_db / sairex_redis).
#
# Writes JSON status for the admin dashboard: ${BACKUP_ROOT}/backup-last-run.json
# Optional Telegram: TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID (via telegram-notify.sh).
#   TELEGRAM_NOTIFY_SUCCESS=true — also message on success (default: failures only).
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
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

notify() {
  "${SCRIPT_DIR}/telegram-notify.sh" "$1" || true
}

write_status_json() {
  # Args: status  error_message  archive_path_or_empty
  local status="$1"
  local err="${2:-}"
  local arch="${3:-}"
  mkdir -p "${BACKUP_ROOT}"
  local out="${BACKUP_ROOT}/backup-last-run.json"
  export _BS_OUT="${out}"
  export _BS_TS="$(date -Iseconds 2>/dev/null || date -u +%Y-%m-%dT%H:%M:%SZ)"
  export _BS_STATUS="${status}"
  export _BS_ERR="${err}"
  export _BS_ARCH="${arch}"
  if ! python3 <<'PY'
import json, os, pathlib, socket
out = os.environ["_BS_OUT"]
ts = os.environ["_BS_TS"]
status = os.environ["_BS_STATUS"]
err = os.environ.get("_BS_ERR") or ""
arch = os.environ.get("_BS_ARCH") or ""
size = 0
if arch and pathlib.Path(arch).is_file():
    size = pathlib.Path(arch).stat().st_size
name = arch.split("/")[-1] if arch else None
with open(out, "w", encoding="utf-8") as f:
    json.dump(
        {
            "timestamp": ts,
            "status": status,
            "error": err or None,
            "archivePath": arch or None,
            "archiveFileName": name,
            "sizeBytes": size,
            "host": socket.gethostname(),
        },
        f,
        indent=2,
    )
PY
  then
    printf '{"timestamp":"%s","status":"%s","error":"status json write failed"}\n' "$(date -Iseconds)" "${status}" >"${out}"
  fi
  unset _BS_OUT _BS_TS _BS_STATUS _BS_ERR _BS_ARCH
}

fail() {
  local msg="$1"
  write_status_json "failed" "${msg}" ""
  notify "❌ SairexSMS backup-stack failed on $(hostname 2>/dev/null): ${msg}"
  echo "[backup-stack] ERROR: ${msg}" >&2
  exit 1
}

mkdir -p "${BACKUP_ROOT}"

if ! docker info >/dev/null 2>&1; then
  fail "docker not available"
fi

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
  fail "container ${DB_CONTAINER} not found"
fi

log "Dumping PostgreSQL (${POSTGRES_DB})…"
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
  rm -rf "${WORKDIR}"
  fail "postgres.sql is empty (pg_dump failed?)"
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

write_status_json "success" "" "${ARCHIVE}"

if [[ "${TELEGRAM_NOTIFY_SUCCESS:-}" == "true" ]]; then
  notify "✅ SairexSMS stack backup OK: $(basename "${ARCHIVE}") ($(du -h "${ARCHIVE}" | cut -f1))"
fi

log "Done."
