# Starts the portable local Postgres (if needed) and runs the app against it.
$pg = "$PSScriptRoot\..\pg-local"
if (-not (Get-NetTCPConnection -LocalPort 54329 -State Listen -ErrorAction SilentlyContinue)) {
  Start-Process node -ArgumentList "start.js" -WorkingDirectory $pg -WindowStyle Hidden
  while (-not (Get-NetTCPConnection -LocalPort 54329 -State Listen -ErrorAction SilentlyContinue)) { Start-Sleep 1 }
}
$env:DATABASE_URL = "postgresql://kroneer:kroneer@localhost:54329/kroneer"
$env:DIRECT_URL = $env:DATABASE_URL
npx nodemon server.js
