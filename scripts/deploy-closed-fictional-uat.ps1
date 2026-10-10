# Deploy ONLY the closed, isolated fictional Coffee Payroll UAT Worker.
# Run from the CoffeePR repository root in Windows PowerShell after switching to
# chat/uat-cobalt-cheque. No D1 migrations, production routes or Access edits.
$ErrorActionPreference = "Stop"

function Assert-Success([string]$step) {
  if ($LASTEXITCODE -ne 0) {
    throw "$step failed (exit code $LASTEXITCODE). The Worker was not advanced to the next step."
  }
}

$branch = (& git branch --show-current).Trim()
Assert-Success "Git branch lookup"
if ($branch -ne "chat/uat-cobalt-cheque") {
  throw "Wrong branch: $branch. Switch to chat/uat-cobalt-cheque before using this script."
}

$changes = & git status --porcelain
Assert-Success "Git working tree check"
if ($changes) {
  throw "Working tree contains uncommitted changes. Commit or stash them before preparing UAT."
}

$bash = "C:\Program Files\Git\bin\bash.exe"
if (-not (Test-Path $bash)) {
  throw "Git Bash is required at $bash. The build script runs in Bash, not native PowerShell."
}

Write-Host "Building fictional UAT from $branch..."
& $bash scripts/build-verified.sh
Assert-Success "Coffee Payroll build"

& node scripts/prepare-fictional-uat.mjs
Assert-Success "Isolated UAT configuration preparation"

& node scripts/verify-fictional-uat.mjs
Assert-Success "Closed UAT configuration verification"

Write-Host "Publishing closed, isolated UAT Worker. Public routes and previews remain OFF."
& npx --no-install wrangler deploy --config dist/server/wrangler.json
Assert-Success "Closed UAT Worker deployment"

Write-Host "Closed UAT Worker deployed. DO NOT enable workers.dev or preview URLs until Cloudflare Access protection is active and verified."
