#!/usr/bin/env bash

set -Eeuo pipefail

APP_DIR="${APP_DIR:-/home/sairex/SairexSMS}"
COMPOSE_FILE_PATH="${COMPOSE_FILE_PATH:-infra/server/docker-compose.prod.yml}"
ENV_FILE_PATH="${ENV_FILE_PATH:-infra/server/server.env.live}"
SAIREX_ENV_FILE_VALUE="${SAIREX_ENV_FILE_VALUE:-$(basename "${ENV_FILE_PATH}")}"
IMAGE_REF="${IMAGE_REF:?IMAGE_REF is required (example: ghcr.io/owner/sairexsms:sha-abc123)}"
RUN_MIGRATIONS="${RUN_MIGRATIONS:-true}"
CREATE_DB_BACKUP="${CREATE_DB_BACKUP:-true}"
UP_NO_DEPS="${UP_NO_DEPS:-true}"
AUTO_CLEAN_CONFLICTS="${AUTO_CLEAN_CONFLICTS:-true}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-7}"
BACKUP_DIR="${BACKUP_DIR:-/opt/sairex/backups}"
POSTGRES_USER="${POSTGRES_USER:-sairex}"
POSTGRES_DB="${POSTGRES_DB:-sairex}"

APP_CONTAINER_NAME="${APP_CONTAINER_NAME:-sairex_app}"
WORKER_CONTAINER_NAME="${WORKER_CONTAINER_NAME:-sairex_worker}"
SMS_WORKER_CONTAINER_NAME="${SMS_WORKER_CONTAINER_NAME:-sairex_sms_worker}"
DB_CONTAINER_NAME="${DB_CONTAINER_NAME:-sairex_db}"
REDIS_CONTAINER_NAME="${REDIS_CONTAINER_NAME:-sairex_redis}"

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

container_exists() {
  local name="$1"
  docker inspect "$name" >/dev/null 2>&1
}

remove_container_if_exists() {
  local name="$1"
  if ! container_exists "$name"; then
    return 0
  fi
  echo "Auto-clean: removing existing container ${name}"
  docker rm -f "$name" >/dev/null 2>&1 || true
}

auto_clean_conflicts_for_app_services() {
  [[ "${AUTO_CLEAN_CONFLICTS}" == "true" ]] || return 0
  remove_container_if_exists "${APP_CONTAINER_NAME}"
  remove_container_if_exists "${WORKER_CONTAINER_NAME}"
  remove_container_if_exists "${SMS_WORKER_CONTAINER_NAME}"
}

auto_clean_conflicts_for_data_services() {
  [[ "${AUTO_CLEAN_CONFLICTS}" == "true" ]] || return 0
  remove_container_if_exists "${DB_CONTAINER_NAME}"
  remove_container_if_exists "${REDIS_CONTAINER_NAME}"
}

timestamp="$(date +%Y%m%d_%H%M%S)"
env_backup="${ENV_FILE_PATH}.bak.${timestamp}"
cp "${ENV_FILE_PATH}" "${env_backup}"

rollback() {
  echo "Deployment failed. Rolling back..."
  cp "${env_backup}" "${ENV_FILE_PATH}"

  up_args=(up -d app worker sms_worker)
  if [[ "${UP_NO_DEPS}" == "true" ]]; then
    up_args=(up -d --no-deps app worker sms_worker)
  fi

  if ! compose_cmd "${up_args[@]}"; then
    echo "Rollback service restart failed. Manual intervention required." >&2
  fi
}

trap rollback ERR

if [[ "${CREATE_DB_BACKUP}" == "true" ]]; then
  auto_clean_conflicts_for_data_services
  if ! mkdir -p "${BACKUP_DIR}" 2>/dev/null; then
    BACKUP_DIR="${APP_DIR}/backups"
    mkdir -p "${BACKUP_DIR}"
  fi
  if ! touch "${BACKUP_DIR}/.write_test" 2>/dev/null; then
    BACKUP_DIR="${APP_DIR}/backups"
    mkdir -p "${BACKUP_DIR}"
  else
    rm -f "${BACKUP_DIR}/.write_test"
  fi
  backup_file="${BACKUP_DIR}/db_${timestamp}.sql"
  echo "Creating database backup: ${backup_file}"
  if [[ -z "$(compose_cmd ps --status running db | awk 'NR>1 {print}')" ]]; then
    echo "Warning: db service is not running; skipping DB backup." >&2
  else
    compose_cmd exec -T db \
      pg_dump -U "${POSTGRES_USER}" "${POSTGRES_DB}" > "${backup_file}"
  fi
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
  auto_clean_conflicts_for_data_services
  compose_cmd run --rm --no-deps migrate
fi

echo "Starting updated services..."
auto_clean_conflicts_for_app_services
if [[ "${UP_NO_DEPS}" == "true" ]]; then
  compose_cmd up -d --no-deps app worker sms_worker
else
  compose_cmd up -d app worker sms_worker
fi

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
