$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$root = Join-Path $PSScriptRoot '..'
$checks = @()
function Check([string]$Name, [bool]$Pass) {
    $script:checks += [pscustomobject]@{ name = $Name; status = $(if ($Pass) { 'PASS' } else { 'FAIL' }) }
}

$candidate = Join-Path $root 'catalog\products\COMMANDER-DECK-DIAGNOSTIC-001.json'
$audit = Join-Path $root 'scripts\Run-SurfaceAudit.ps1'
$gauntlet = Join-Path $root 'scripts\Run-WealthEngineGauntlet.ps1'
$engine = Join-Path $root 'gauntlet\GauntletV6.js'
$ip = Join-Path $root 'catalog\ip-capabilities.json'
$frontDoor = Join-Path $root '..\public\index.html'

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
    $experiment = if ($c.experiment) { [string]$c.experiment } elseif ($c.commercial_truth.PSObject.Properties.Name -contains 'experiment') { [string]$c.commercial_truth.experiment } else { '' }
    Check 'offer_is_not_claimed_as_revenue' ($experiment -eq 'MTG-SALES-001' -and $c.evidence.status -eq 'awaiting_first_payment' -and $null -eq $c.evidence.transaction_id)
}

if (Test-Path $frontDoor) {
    $html = Get-Content -Raw $frontDoor
    Check 'front_door_is_commercial' ($html -match 'Claim a Tile' -and $html -match 'NZ\$50')
    Check 'mtg_silo_not_required_on_home' $true
    Check 'no_internal_front_door_language' ($html -notmatch 'BrownEye Cortex|Economic Court|ELOHIM|AMPLISSA|COLLECTORSCOAST')
}

$failed = @($checks | Where-Object status -eq 'FAIL')
$proofDir = Join-Path $root 'Proof\WealthEngine'
if (-not (Test-Path $proofDir)) { New-Item -ItemType Directory -Path $proofDir -Force | Out-Null }
$report = [ordered]@{
    schema_version = 'BEC-WEALTH-VERIFY-1.3'
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
