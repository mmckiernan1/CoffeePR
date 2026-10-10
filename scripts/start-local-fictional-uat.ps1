# Build and run only the isolated Coffee Payroll fictional UAT on this desktop.
# No Cloudflare deployment, migrations, public routes or production DB access.
$ErrorActionPreference = "Stop"

function Assert-Exit([string]$operation) {
  if ($LASTEXITCODE -ne 0) { throw "$operation failed (exit code $LASTEXITCODE)." }
}

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Push-Location $root
try {
  $branch = (& git branch --show-current).Trim()
  Assert-Exit "Git branch lookup"
  if ($branch -ne "chat/uat-cobalt-cheque") {
    throw "Expected the UAT branch, not '$branch'. Nothing started."
  }

  if (& git status --porcelain) {
    throw "Uncommitted project changes detected. Nothing started."
  }
  Assert-Exit "Git working tree check"

  $bash = "C:\Program Files\Git\bin\bash.exe"
  if (-not (Test-Path $bash)) { throw "Git Bash was not found at $bash." }

  & $bash scripts/build-verified.sh
  Assert-Exit "Build"

  & node scripts/prepare-fictional-uat.mjs
  Assert-Exit "UAT package preparation"

  & node scripts/verify-fictional-uat.mjs
  Assert-Exit "UAT isolation verification"

  Write-Host ""
  Write-Host "LOCAL UAT ONLY: http://127.0.0.1:8787/uat/fictional"
  Write-Host "Keep this window open for testing. Press Ctrl+C when finished."
  Write-Host "No Cloudflare deployment or database connection will be made."
  & npx --no-install wrangler dev --config dist/server/wrangler.json --local --ip 127.0.0.1 --port 8787
} finally {
  Pop-Location
}
