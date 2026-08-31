$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$root = Join-Path $PSScriptRoot '..'
$checks = @()
function Check([string]$Name, [bool]$Pass) {
    $script:checks += [pscustomobject]@{ name = $Name; status = $(if ($Pass) { 'PASS' } else { 'FAIL' }) }
}

# Verify the actual approved first-sale product instead of a stale pre-compiler candidate.
$candidate = Join-Path $root 'catalog\products\COMMANDER-DECK-DIAGNOSTIC-001.json'
$audit = Join-Path $root 'scripts\Run-SurfaceAudit.ps1'
$gauntlet = Join-Path $root 'scripts\Run-WealthEngineGauntlet.ps1'
$engine = Join-Path $root 'gauntlet\GauntletV6.js'
$ip = Join-Path $root 'catalog\ip-capabilities.json'
$frontDoor = Join-Path $root '..\..\public\index.html'
$proof = Join-Path $root 'Proof\WealthEngine\WEALTH-ENGINE-CANDIDATE-GAUNTLET.json'

Check 'offer_exists' (Test-Path $candidate)
Check 'surface_audit_script_exists' (Test-Path $audit)
Check 'wealth_gauntlet_runner_exists' (Test-Path $gauntlet)
Check 'gauntlet_engine_exists' (Test-Path $engine)
Check 'ip_capability_catalog_exists' (Test-Path $ip)
Check 'neutral_front_door_exists' (Test-Path $frontDoor)

if (Test-Path $candidate) {
    $c = Get-Content -Raw $candidate | ConvertFrom-Json
    Check 'offer_price_is_29_nzd' ([int]$c.price -eq 29 -and $c.currency -eq 'nzd')
    Check 'offer_is_live' ($c.status -eq 'published' -and $c.commercial_truth.approval_required -eq $false)
    Check 'offer_is_not_still_approval_blocked' ($c.commercial_truth.approval_required -eq $false)
    Check 'offer_is_not_claimed_as_revenue' ($c.commercial_truth.experiment -eq 'BEC-PRIME-FIRST-SALE-001' -and $c.evidence.status -eq 'awaiting_first_payment' -and $null -eq $c.evidence.transaction_id)
}

if (Test-Path $frontDoor) {
    $html = Get-Content -Raw $frontDoor
    Check 'front_door_is_horizontal' ($html -match 'overflow-x:auto' -and $html -match 'scroll-snap-type:x')
    Check 'dreamiez_entry_exists' ($html -match 'DreamMee')
    Check 'mtg_is_silo_entry' ($html -match 'href="/mtg"' -and $html -match 'Commander Deck Diagnostic')
}

$failed = @($checks | Where-Object status -eq 'FAIL')
$proofDir = Join-Path $root 'Proof\WealthEngine'
if (-not (Test-Path $proofDir)) { New-Item -ItemType Directory -Path $proofDir -Force | Out-Null }
$report = [ordered]@{
    schema_version = 'BEC-WEALTH-VERIFY-1.2'
    event = 'wealth_engine.verification'
    status = $(if ($failed.Count -eq 0) { 'PASS' } else { 'FAIL' })
    revenue_truth = 'NZD 0 until a real payment webhook supplies a real transaction_id'
    checks = $checks
    verified_at_utc = (Get-Date).ToUniversalTime().ToString('o')
}
$report | ConvertTo-Json -Depth 10 | Set-Content -Path (Join-Path $proofDir 'WEALTH-ENGINE-VERIFY.json') -Encoding UTF8

$checks | Format-Table -AutoSize
if ($failed.Count -gt 0) { exit 1 }
Write-Host 'VERIFY_PASS' -ForegroundColor Green
