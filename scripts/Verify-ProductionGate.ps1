#Requires -Version 5.1
$ErrorActionPreference = "Stop"
$ROOT = "D:\DreamLedgerMTG"
$timestamp = (Get-Date).ToString("s")
$results = @{
    system = "DreamLedger MTG"
    version = "2.5"
    timestamp = $timestamp
    checks = @()
    assets = 0
    revenue_gate = "UNKNOWN"
}
function Add-Check {
    param([string]$Name, [bool]$Pass, [string]$Details = "")
    $results.checks += @{ name = $Name; pass = $Pass; details = $Details }
}

# 1. Passport validation
$passports = Get-ChildItem "$ROOT\passports\*.json" -ErrorAction SilentlyContinue
$passportCount = $passports.Count
$passportValid = $true
foreach ($p in $passports) {
    try {
        $json = Get-Content $p.FullName -Raw | ConvertFrom-Json
        if (-not $json.asset_id -or -not $json.silo_id) { $passportValid = $false }
    } catch { $passportValid = $false }
}
Add-Check "passport_system" ($passportCount -gt 0 -and $passportValid) "Count: $passportCount"
$results.assets = $passportCount

# 2. Ledger chain
$ledger = "$ROOT\ledger\chain.jsonl"
$ledgerValid = $false
if (Test-Path $ledger) {
    $lines = Get-Content $ledger
    if ($lines.Count -gt 0) {
        $prev = "genesis"
        $ok = $true
        foreach ($line in $lines) {
            $evt = $line | ConvertFrom-Json
            if ($evt.previous_hash -ne $prev) { $ok = $false; break }
            $prev = $evt.event_hash
        }
        $ledgerValid = $ok
    }
}
Add-Check "ledger_chain" $ledgerValid "Entries: $($lines.Count)"

# 3. Visibility policy
$vis = Test-Path "$ROOT\config\visibility_policy.json"
Add-Check "visibility_policy" $vis ""

# 4. Revenue system
$revenueState = Test-Path "$ROOT\revenue\revenue_state.json"
$revenueAtoms = (Get-ChildItem "$ROOT\revenue\atoms\*.json" -ErrorAction SilentlyContinue).Count
Add-Check "revenue_system" ($revenueState -or $revenueAtoms -gt 0) "Atoms: $revenueAtoms"

# 5. No secrets in repo
$secretsFound = (Select-String -Path "$ROOT\**\*.json", "$ROOT\**\*.py", "$ROOT\**\*.js" -Pattern "sk_live_|sk_test_|ntn_|whsec_|GITHUB_TOKEN" -ErrorAction SilentlyContinue).Count -gt 0
Add-Check "no_secrets_in_repo" (-not $secretsFound) ""

# 6. Revenue gate status
$gateStatus = "WAITING_FOR_FIRST_TRANSACTION"
if ($revenueAtoms -gt 0) { $gateStatus = "REVENUE_ATOMS_DETECTED" }
if ($passportCount -gt 0 -and $revenueAtoms -eq 0) { $gateStatus = "READY_FOR_SALE" }
$results.revenue_gate = $gateStatus

# Output proof
$proofPath = "$ROOT\proofs\production\production_gate_$((Get-Date).ToString('yyyyMMdd-HHmmss')).json"
$results | ConvertTo-Json -Depth 5 | Set-Content $proofPath -Encoding UTF8

# Console summary
Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host " DREAMLEDGER MTG PRODUCTION GATE" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
foreach ($c in $results.checks) {
    $color = if ($c.pass) { "Green" } else { "Red" }
    Write-Host "$(if ($c.pass) { '' } else { '' }) $($c.name) - $($c.details)" -ForegroundColor $color
}
Write-Host ""
Write-Host "Assets detected: $($results.assets)" -ForegroundColor Yellow
Write-Host "Revenue gate: $($results.revenue_gate)" -ForegroundColor Yellow
Write-Host ""
Write-Host "Proof artifact: $proofPath" -ForegroundColor Gray
if ($results.revenue_gate -eq "WAITING_FOR_FIRST_TRANSACTION") {
    Write-Host "SYSTEM STATUS: READY FOR SALE" -ForegroundColor Green
} else {
    Write-Host "SYSTEM STATUS: $($results.revenue_gate)" -ForegroundColor Yellow
}
