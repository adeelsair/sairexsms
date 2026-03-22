# Production ops checklist (SairexSMS)

This doc turns **reactive firefighting** into **repeatable prevention**. It incorporates post-incident hardening (disk full → Redis/Postgres/login outages).

## Incident pattern to avoid

> App works → Docker/images grow → **disk fills** → Redis/Postgres/git fail → **outage**

The codebase now includes **safer deploy ordering** (`infra/server/deploy-safe.sh`, `docker-compose.prod.yml`). **Disk and Docker growth** still require **monitoring + scheduled cleanup** on the server.

---

## 0. One-command bootstrap (recommended on VPS)

After `git pull`, run **once** (adjust `SAIREX_REPO` if your path differs):

```bash
cd ~/SairexSMS
chmod +x infra/server/scripts/bootstrap-server-automation.sh infra/server/scripts/nginx-reload-if-ok.sh
SAIREX_REPO="$HOME/SairexSMS" bash infra/server/scripts/bootstrap-server-automation.sh --dry-run
# Then (needs passwordless sudo OR run in an interactive root/sudo session):
SAIREX_REPO="$HOME/SairexSMS" bash infra/server/scripts/bootstrap-server-automation.sh --all-safe
```

What **`--all-safe`** does:

- Installs **`curl`**, **`ncdu`**, tries **`jq`**
- Installs & starts **fail2ban**
- Adds **`/etc/cron.weekly/sairex-journal-vacuum`** (`journalctl --vacuum-time=7d`)
- Replaces your user crontab’s **managed block** (marked `# BEGIN sairex-automation` … `# END`) with:
  - weekly **`docker-prune-safe.sh`**
  - every 6h **`disk-alert.sh`**
  - weekly **`nginx-reload-if-ok.sh`** (no-op if nginx not installed)

**Not included by default (intentionally):**

- **Docker `daemon.json` log limits** — opt-in:  
  `ALLOW_DOCKER_RESTART=true` plus `--with-docker-logging` (restarts Docker → **brief downtime**).

**Rejected patterns** (do **not** copy from random guides):

| Pattern | Why |
|--------|-----|
| `docker system prune -af --volumes` on a timer | Can delete **volumes** → **data loss** |
| `(crontab -l; echo line) \| crontab -` run repeatedly | **Duplicates** cron lines every run |
| `docker update --restart` on **all** containers | Unpredictable; Compose already sets **`restart:`** |
| User crontab `journalctl …` without `sudo` | Usually **fails silently** (no permission) |

---

## 1. Safe Docker cleanup (mandatory)

**Do not** schedule `docker system prune -af --volumes` blindly: `--volumes` can remove **unused** named volumes and has caused **data loss** in the wild. Postgres/Redis data lives on bind mounts today, but keep habits safe.

**Use the repo script** (no volume prune):

```bash
chmod +x ~/SairexSMS/infra/server/scripts/docker-prune-safe.sh
```

**Cron** (example: weekly Sunday 03:15, user in `docker` group):

```cron
15 3 * * 0 /home/sairex/SairexSMS/infra/server/scripts/docker-prune-safe.sh >>/var/log/sairex-docker-prune.log 2>&1
```

Review logs monthly; adjust frequency if the server is tight on disk.

---

## 2. Disk monitoring (very important)

**Interactive inspection:**

```bash
sudo apt install -y ncdu   # optional
sudo ncdu -x /             # stay on one filesystem
```

**Automated threshold check** (repo script):

```bash
chmod +x ~/SairexSMS/infra/server/scripts/disk-alert.sh
THRESHOLD_PERCENT=80 ~/SairexSMS/infra/server/scripts/disk-alert.sh
```

**Cron + mail** (if `mail` works on the host):

```cron
0 */6 * * * /home/sairex/SairexSMS/infra/server/scripts/disk-alert.sh || echo "Disk warning on $(hostname)" | mail -s "SairexSMS disk" you@example.com
```

**External monitoring:** point **UptimeRobot** (or similar) at `https://app.sairex-sms.com/api/health`. You also have **Uptime Kuma** in `docker-compose.prod.yml` on port `3001` — use it for `/api/health` and consider a second check on **disk** via a small metrics agent later.

---

## 3. Git hygiene on the server

After emergency deploys, **don’t leave stashes forever**:

```bash
cd ~/SairexSMS
git stash list
git stash show -p 'stash@{0}'   # inspect
git stash drop                   # only if obsolete
```

Prefer **no uncommitted edits** on the deploy host; change flow should be **GitHub → pull → deploy script**.

---

## 4. SSH hardening (do on the server)

**Goals:** keys only, no root SSH, reduce brute force noise.

On the VPS (as root or sudo):

```bash
sudo nano /etc/ssh/sshd_config
```

Recommended (validate before closing your session — keep a second root shell open):

- `PasswordAuthentication no`
- `PermitRootLogin no`
- `PubkeyAuthentication yes`

Then:

```bash
sudo systemctl restart ssh
```

**Never** publish host/IP/username in public channels; bots scan constantly.

---

## 5. Fail2ban (basic)

```bash
sudo apt install -y fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

Tune jails for your SSH port if non-default.

---

## 6. Log rotation (Docker / host)

- **Docker:** `json-file` driver already has `max-size` / `max-file` on key services in `docker-compose.prod.yml`.
- **Host:** ensure `journald` disk caps are sane (`/etc/systemd/journald.conf`) if logs grow.

---

## 7. Backups (already partially automated)

`deploy-safe.sh` can create DB dumps before deploy. Also:

- Verify **backup directory** has space and retention (`BACKUP_RETENTION_DAYS`).
- Periodically **test restore** on a non-prod machine.

---

## Maturity snapshot

| Area        | Target                         |
| ----------- | ------------------------------ |
| App         | Ship via CI, typed, tested     |
| Infra       | Compose + healthchecks + deploy script |
| DevOps      | **Cron prune + disk alert + external uptime** |
| Reliability | No silent disk exhaustion      |

---

## Related repo files

- `DEPLOYMENT.md` — deploy flow + “Reliable deploys”
- `infra/server/README.md` — server layout
- `infra/server/scripts/bootstrap-server-automation.sh` — idempotent cron + optional fail2ban/journal/nginx
- `infra/server/scripts/docker-prune-safe.sh`
- `infra/server/scripts/disk-alert.sh`
- `infra/server/scripts/nginx-reload-if-ok.sh`
