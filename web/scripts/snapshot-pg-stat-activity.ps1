$OutputPath = Join-Path (Resolve-Path "$PSScriptRoot\..").Path "artifacts\pg-stat-activity-snapshots.txt"
New-Item -ItemType Directory -Force -Path (Split-Path -Parent $OutputPath) | Out-Null
Set-Content -Path $OutputPath -Value "" -Encoding utf8

for ($i = 1; $i -le 5; $i++) {
  Add-Content -Path $OutputPath -Value "=== Snapshot $i @ $(Get-Date -Format o) ===" -Encoding utf8
  $total = docker exec sairex_db psql -U sairex -d sairex -c "SELECT count(*) FROM pg_stat_activity;"
  $states = docker exec sairex_db psql -U sairex -d sairex -c "SELECT state, count(*) FROM pg_stat_activity GROUP BY state ORDER BY state;"
  Add-Content -Path $OutputPath -Value $total -Encoding utf8
  Add-Content -Path $OutputPath -Value $states -Encoding utf8
  Add-Content -Path $OutputPath -Value "" -Encoding utf8
  Start-Sleep -Seconds 2
}

Write-Output "Saved snapshots to $OutputPath"
