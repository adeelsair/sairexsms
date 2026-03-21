param(
  [string]$RepoRoot = "c:\SairexSMS",
  [switch]$ShowDeployRuns,
  [switch]$ShowDockerRuns
)

$ErrorActionPreference = "Stop"

Write-Host "== Release Sync Check ==" -ForegroundColor Cyan

Set-Location "$RepoRoot\web"

Write-Host "`n[1/4] Git parity" -ForegroundColor Yellow
git fetch origin main | Out-Null
$head = (git rev-parse HEAD).Trim()
$origin = (git rev-parse origin/main).Trim()
$status = git status --short

Write-Host "HEAD:        $head"
Write-Host "origin/main: $origin"
if ([string]::IsNullOrWhiteSpace($status)) {
  Write-Host "Working tree: clean" -ForegroundColor Green
} else {
  Write-Host "Working tree has changes:" -ForegroundColor Red
  Write-Host $status
}

Write-Host "`n[2/4] Prisma migration status (local .env.local)" -ForegroundColor Yellow
npx dotenv -e .env.local -- npx prisma migrate status --schema ../prisma/schema.prisma

Write-Host "`n[3/4] Recent Docker workflow runs" -ForegroundColor Yellow
gh run list --workflow "Docker" --limit 5

if ($ShowDeployRuns) {
  Write-Host "`n[4/4] Recent Deploy Production runs" -ForegroundColor Yellow
  gh run list --workflow "Deploy Production" --limit 5
}

if ($ShowDockerRuns) {
  Write-Host "`n[Extra] Latest workflow runs" -ForegroundColor Yellow
  gh run list --limit 10
}

Write-Host "`nDone." -ForegroundColor Green

