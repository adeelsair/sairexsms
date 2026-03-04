# ==============================
# SAIREXSMS PHASE BACKUP SCRIPT
# ==============================

$ErrorActionPreference = "Stop"

$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm"
$backupRoot = "backups\Phase3_$timestamp"

Write-Host "Creating backup folder..."
New-Item -ItemType Directory -Force -Path $backupRoot | Out-Null

# ------------------------------
# 1. DATABASE BACKUP
# ------------------------------
Write-Host "Backing up PostgreSQL database..."
docker exec -t sairex_db pg_dump -U sairex -d sairex --no-owner --no-privileges `
  > "$backupRoot\database.sql"

if (!(Test-Path "$backupRoot\database.sql")) {
    Write-Error "Database backup failed!"
    exit 1
}

# ------------------------------
# 2. DOCKER VOLUME BACKUP
# ------------------------------
Write-Host "Backing up Docker volume..."
$mountMap = docker inspect sairex_db --format '{{range .Mounts}}{{.Destination}}={{.Name}}{{println}}{{end}}'
$postgresVolume = ($mountMap | Where-Object { $_ -like "/var/lib/postgresql/data=*" } | Select-Object -First 1).Split("=")[1]
if ([string]::IsNullOrWhiteSpace($postgresVolume)) {
    Write-Error "Could not detect Postgres data volume from sairex_db."
    exit 1
}

$backupAbsPath = (Resolve-Path $backupRoot).Path
docker run --rm `
  -v "${postgresVolume}:/volume" `
  -v "${backupAbsPath}:/backup" `
  alpine `
  tar czf /backup/postgres_volume.tar.gz -C /volume .

# ------------------------------
# 3. GIT SNAPSHOT
# ------------------------------
Write-Host "Creating Git snapshot..."
git add .
git commit -m "PHASE 3 START AUTO BACKUP $timestamp" | Out-Null
git tag "PHASE3_START_$timestamp"

git rev-parse HEAD > "$backupRoot\commit_hash.txt"

# ------------------------------
# 4. ENV & CONFIG BACKUP
# ------------------------------
Write-Host "Backing up environment and config files..."
Copy-Item .env "$backupRoot\.env" -ErrorAction SilentlyContinue
Copy-Item .env.production "$backupRoot\.env.production" -ErrorAction SilentlyContinue
Copy-Item docker-compose.yml "$backupRoot\docker-compose.yml" -ErrorAction SilentlyContinue
Copy-Item package.json "$backupRoot\package.json" -ErrorAction SilentlyContinue

if (Test-Path "next.config.js") {
  Copy-Item next.config.js "$backupRoot\next.config.js" -ErrorAction SilentlyContinue
} elseif (Test-Path "web\next.config.ts") {
  Copy-Item "web\next.config.ts" "$backupRoot\next.config.ts" -ErrorAction SilentlyContinue
}

# ------------------------------
# 5. SUMMARY FILE
# ------------------------------
@"
SAIREX SMS - PHASE 3 START BACKUP
Timestamp: $timestamp
Database: sairex
Docker Container: sairex_db
Docker Volume: $postgresVolume
Git Tag: PHASE3_START_$timestamp
"@ | Out-File "$backupRoot\BACKUP_INFO.txt"

Write-Host ""
Write-Host "PHASE 3 BACKUP COMPLETE"
Write-Host "Location: $backupRoot"
Write-Host ""
