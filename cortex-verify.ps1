# cortex-verify.ps1
# DreamLedger Verification Harness (BrownEye Cortex)
# Purpose: End-to-end sanity + deployment + runtime probe

$ErrorActionPreference = "Stop"

Write-Host "[VERIFY] DreamLedger system probe starting..."

$errors = 0

function Check($name, $cmd) {
    Write-Host "[CHECK] $name"
    try {
        $result = Invoke-Expression $cmd 2>$null
        Write-Host "[OK] $name"
        return $result
    } catch {
        Write-Host "[FAIL] $name"
        $script:errors++
        return $null
    }
}

$remote = Check "Git remote" "git remote -v"
$log = Check "Latest commit" "git log -1 --oneline"
$remoteHead = Check "Remote HEAD" "git ls-remote origin main"

$health = Check "Health endpoint" "curl -s https://dreamledger.org/health"
$listings = Check "Listings endpoint" "curl -s https://dreamledger.org/api/listings"

if ($health -and $health -notmatch "ok") {
    Write-Host "[WARN] Health endpoint not OK payload"
    $errors++
}

if (-not $listings) {
    Write-Host "[WARN] Listings endpoint empty or unreachable"
    $errors++
}

Write-Host "[INFO] Render checks (manual): node server.js + node scripts/event-worker.js"
Write-Host "[INFO] Ensure Supabase migration applied"

$status = if ($errors -eq 0) { "PASS" } else { "FAIL" }

$reportPath = Join-Path (Get-Location) "verify-report.log"

@"
DreamLedger Verification Report
Timestamp: $(Get-Date -Format o)
Status: $status
Errors: $errors
Health: $health
Listings: $listings
Remote: $remoteHead
"@ | Out-File $reportPath -Encoding utf8

Write-Host "[DONE] Verification complete: $status"
Write-Host "[ARTIFACT] $reportPath"
