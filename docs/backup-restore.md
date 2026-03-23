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

Each run also writes **`backup-last-run.json`** in the backup directory (status, timestamp, errors) for your own monitoring or scripts.

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
