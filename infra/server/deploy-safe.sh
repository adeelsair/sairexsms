#!/usr/bin/env bash

set -Eeuo pipefail

APP_DIR="${APP_DIR:-/home/sairex/SairexSMS}"
COMPOSE_FILE_PATH="${COMPOSE_FILE_PATH:-infra/server/docker-compose.prod.yml}"
ENV_FILE_PATH="${ENV_FILE_PATH:-infra/server/server.env.live}"
SAIREX_ENV_FILE_VALUE="${SAIREX_ENV_FILE_VALUE:-$(basename "${ENV_FILE_PATH}")}"
IMAGE_REF="${IMAGE_REF:?IMAGE_REF is required (example: ghcr.io/owner/sairexsms:sha-abc123)}"
RUN_MIGRATIONS="${RUN_MIGRATIONS:-true}"
CREATE_DB_BACKUP="${CREATE_DB_BACKUP:-true}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-7}"
BACKUP_DIR="${BACKUP_DIR:-/opt/sairex/backups}"
POSTGRES_USER="${POSTGRES_USER:-sairex}"
POSTGRES_DB="${POSTGRES_DB:-sairex}"

cd "${APP_DIR}"

if [[ ! -f "${COMPOSE_FILE_PATH}" ]]; then
  echo "Compose file not found: ${COMPOSE_FILE_PATH}" >&2
  exit 1
fi

if [[ ! -f "${ENV_FILE_PATH}" ]]; then
  echo "Env file not found: ${ENV_FILE_PATH}" >&2
  exit 1
fi

compose_cmd() {
  SAIREX_ENV_FILE="${SAIREX_ENV_FILE_VALUE}" \
    docker compose -f "${COMPOSE_FILE_PATH}" --env-file "${ENV_FILE_PATH}" "$@"
}

timestamp="$(date +%Y%m%d_%H%M%S)"
env_backup="${ENV_FILE_PATH}.bak.${timestamp}"
cp "${ENV_FILE_PATH}" "${env_backup}"

rollback() {
  echo "Deployment failed. Rolling back..."
  cp "${env_backup}" "${ENV_FILE_PATH}"

  if ! compose_cmd up -d app worker sms_worker; then
    echo "Rollback service restart failed. Manual intervention required." >&2
  fi
}

trap rollback ERR

if [[ "${CREATE_DB_BACKUP}" == "true" ]]; then
  if ! mkdir -p "${BACKUP_DIR}" 2>/dev/null; then
    BACKUP_DIR="${APP_DIR}/backups"
    mkdir -p "${BACKUP_DIR}"
  fi
  backup_file="${BACKUP_DIR}/db_${timestamp}.sql"
  echo "Creating database backup: ${backup_file}"
  compose_cmd exec -T db \
    pg_dump -U "${POSTGRES_USER}" "${POSTGRES_DB}" > "${backup_file}"
fi

if grep -q '^SAIREX_IMAGE=' "${ENV_FILE_PATH}"; then
  sed -i "s|^SAIREX_IMAGE=.*|SAIREX_IMAGE=${IMAGE_REF}|" "${ENV_FILE_PATH}"
else
  echo "SAIREX_IMAGE=${IMAGE_REF}" >> "${ENV_FILE_PATH}"
fi

echo "Validating compose configuration..."
compose_cmd config > /dev/null

echo "Pulling latest images..."
compose_cmd pull app worker sms_worker migrate

if [[ "${RUN_MIGRATIONS}" == "true" ]]; then
  echo "Running migrations..."
  compose_cmd run --rm migrate
fi

echo "Starting updated services..."
compose_cmd up -d app worker sms_worker

echo "Waiting for app container health..."
for i in {1..20}; do
  app_health="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}running{{end}}' sairex_app 2>/dev/null || true)"
  if [[ "${app_health}" == "healthy" || "${app_health}" == "running" ]]; then
    break
  fi
  sleep 5
done

app_health="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}running{{end}}' sairex_app 2>/dev/null || true)"
if [[ "${app_health}" != "healthy" && "${app_health}" != "running" ]]; then
  echo "App container is not healthy (status: ${app_health})." >&2
  exit 1
fi

if [[ -z "$(compose_cmd ps --status running sms_worker | awk 'NR>1 {print}')" ]]; then
  echo "SMS worker is not running." >&2
  exit 1
fi

if [[ "${CREATE_DB_BACKUP}" == "true" ]]; then
  find "${BACKUP_DIR}" -type f -name "db_*.sql" -mtime +"${BACKUP_RETENTION_DAYS}" -delete || true
fi

rm -f "${env_backup}"
trap - ERR
echo "Deployment completed successfully with image: ${IMAGE_REF}"
