# Backup & restore (production)

Canonical tooling lives in the repo:

| Script | Purpose |
|--------|---------|
| `infra/server/scripts/backup-stack.sh` | **Full** archive: Postgres SQL dump, Redis `/data`, config copies, optional uploads + optional `rclone`. |
| `infra/server/scripts/restore-stack.sh` | **Disruptive** restore from that archive (DB drop/create + Redis files). |
| `infra/server/deploy-safe.sh` | **Pre-deploy** fast `pg_dump` only (`db_*.sql`) when `CREATE_DB_BACKUP=true` — keeps deploy quick. |

Legacy root scripts (`backup.sh`, `system_backup.py`, `phase3-backup.ps1`) were **removed** — they used wrong names, formats, or **hardcoded secrets**.

---

## What gets backed up (`backup-stack.sh`)

1. **PostgreSQL** — `pg_dump` plain SQL (same style as `deploy-safe.sh`), database `${POSTGRES_DB}` (default `sairex`).
2. **Redis** — `SAVE` then `docker cp` of container `/data` (works with AOF + any `dump.rdb`).
3. **Config** — copies (if present):  
   `infra/server/server.env.live`, `infra/server/.env`, `infra/server/docker-compose.prod.yml`  
   **These files contain secrets.** Archives are `chmod 600`; store off-server encrypted if possible.
4. **Uploads (optional)** — set `SAIREX_UPLOADS_PATH=/host/path` if you bind-mount uploads.
5. **Off-server (optional)** — `RCLONE_REMOTE_PATH=remote:bucket/prefix` after `rclone config`.

Output: `~/sairex-stack-backups/sairex-stack-YYYYMMDD_HHMMSS.tar.gz`  
Retention: `RETENTION_DAYS` (default **14**), same directory.

Each run also writes **`backup-last-run.json`** in the backup directory (status, timestamp, errors). The admin **System → Backups** page reads this file plus archive metadata (no download of `.tar.gz` through the app).

---

## Admin dashboard (`/admin/backups`)

**SUPER_ADMIN only** (sidebar: **System → Backups**). Lists `sairex-stack-*.tar.gz` (name, size, modified time), shows the latest `backup-last-run.json`, optional **disk usage** for the app container (`fs.statfs`), and warnings when:

- the last run **failed**,
- there is **no archive** in the directory,
- the newest archive is **older than ~26 hours** (stale cron / failed job), or
- disk use on the checked path is **≥ 80%** (aligned with `disk-alert.sh`).

### Why Next.js API routes (not `apps/api` Express)

SairexSMS admin already authenticates via **Next.js** (`requireAuth` / `requireRole`). The backup dashboard is implemented as **`GET /api/admin/backups`** plus `web/lib/server/backup-dashboard.ts` so there is a **single** secured surface and no duplicate Express router to keep in sync. The separate **`apps/api`** service is for payments/SMS workers, not this UI.

**Legacy:** `GET /api/admin/stack-backups` and `/admin/stack-backups` still work (alias / redirect).

**Not exposed over HTTP:** one-click “run backup”, restore, or archive download — those belong on the host (cron, SSH, `restore-stack.sh`) to avoid long-running or destructive actions from a browser session.

### App container configuration

1. On the host, keep archives in a single directory (same as `BACKUP_ROOT` in `backup-stack.sh`, e.g. `~/sairex-stack-backups`).
2. Mount that directory into the **`app`** service **read-only**.
3. Set on the app process (e.g. in `infra/server/.env` loaded by Compose):

| Variable | Purpose |
|----------|---------|
| `BACKUP_ARCHIVE_DIR` | **Required** for the dashboard — absolute path **inside the container** to the mounted backup folder. |
| `BACKUP_STATUS_FILE` | Optional. Defaults to `{BACKUP_ARCHIVE_DIR}/backup-last-run.json`. |
| `BACKUP_DISK_STAT_PATH` | Optional. Path for `statfs` disk widget (default **`/`**). Use the mount you care about (often root FS on the VPS). |

Example Compose snippet (paths on host vary):

```yaml
# under services.app:
volumes:
  - /home/sairex/sairex-stack-backups:/var/backups/sairex-stack:ro
```

```bash
BACKUP_ARCHIVE_DIR=/var/backups/sairex-stack
# BACKUP_DISK_STAT_PATH=/
```

API: **`GET /api/admin/backups`** (same auth as the page). Restore stays **CLI-only** (`restore-stack.sh` with explicit confirmation env vars).

---

## Telegram alerts (host / cron)

Optional. Scripts use **`telegram-notify.sh`** (no tokens in git). Export on the host or in the cron wrapper:

| Variable | Purpose |
|----------|---------|
| `TELEGRAM_BOT_TOKEN` | Bot token from BotFather |
| `TELEGRAM_CHAT_ID` | Target chat |
| `TELEGRAM_NOTIFY_SUCCESS` | Set to `true` for `backup-stack.sh` to ping on **success** as well (default: notify on **failure** only). |

`disk-alert.sh` notifies when disk usage exceeds its threshold (see script header for env).

---

## Cron (daily)

```bash
chmod +x ~/SairexSMS/infra/server/scripts/backup-stack.sh
# 02:10 daily (adjust if it collides with other jobs)
10 2 * * * SAIREX_REPO=/home/sairex/SairexSMS /home/sairex/SairexSMS/infra/server/scripts/backup-stack.sh >>/home/sairex/logs/sairex-backup-stack.log 2>&1
```

---

## Off-server copy (strongly recommended)

If the VPS disk dies, **local tar files are not enough**.

```bash
sudo apt install -y rclone
rclone config
export RCLONE_REMOTE_PATH='myremote:sairex-backups'
```

`backup-stack.sh` will `rclone copy` the new archive when `RCLONE_REMOTE_PATH` is set (export in cron line or wrap script).

---

## Restore (`restore-stack.sh`)

**This destroys the current database contents** (drop/create) and overwrites Redis data files.

```bash
cd ~/SairexSMS
chmod +x infra/server/scripts/restore-stack.sh

CONFIRM=YES_I_WILL_LOSE_CURRENT_DATA \
FRESH_DATABASE_RESTORE=true \
SAIREX_REPO=/home/sairex/SairexSMS \
./infra/server/scripts/restore-stack.sh /path/to/sairex-stack-20260322_120000.tar.gz
```

Then:

1. Restore any **config** files from the archive’s `config/` tree **manually** after inspection.
2. Run **migrations** if the archive is older than current schema:  
   `docker compose ... run --rm migrate` (same as normal deploy).
3. Verify **`/api/health`**.

---

## Rejected patterns (from generic guides)

| Anti-pattern | Why |
|--------------|-----|
| `docker exec postgres pg_dumpall` | Wrong container/user; not your stack. |
| `docker system prune --volumes` after backup | **Data loss.** |
| Storing **only** on same disk as prod | Server loss = backup loss. |

---

## Pre-deploy SQL-only backups

`deploy-safe.sh` still writes `db_<timestamp>.sql` under `BACKUP_DIR` for a **rollback-friendly snapshot before image/migrate**. That is **not** a full DR bundle (no Redis/config).
