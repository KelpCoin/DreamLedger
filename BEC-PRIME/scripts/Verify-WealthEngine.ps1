$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$root = Join-Path $PSScriptRoot '..'
$checks = @()
function Check([string]$Name, [bool]$Pass) {
    $script:checks += [pscustomobject]@{ name = $Name; status = $(if ($Pass) { 'PASS' } else { 'FAIL' }) }
}

$candidate = Join-Path $root 'catalog\products\BEC-SURFACE-AUDIT-500.json'
$audit = Join-Path $root 'scripts\Run-SurfaceAudit.ps1'
$gauntlet = Join-Path $root 'scripts\Run-WealthEngineGauntlet.ps1'
$engine = Join-Path $root 'gauntlet\GauntletV6.js'
$ip = Join-Path $root 'catalog\ip-capabilities.json'
$frontDoor = Join-Path $root '..\index.html'
$proof = Join-Path $root 'Proof\WealthEngine\WEALTH-ENGINE-CANDIDATE-GAUNTLET.json'

Check 'candidate_exists' (Test-Path $candidate)
Check 'surface_audit_script_exists' (Test-Path $audit)
Check 'wealth_gauntlet_runner_exists' (Test-Path $gauntlet)
Check 'gauntlet_engine_exists' (Test-Path $engine)
Check 'ip_capability_catalog_exists' (Test-Path $ip)
Check 'neutral_front_door_exists' (Test-Path $frontDoor)

if (Test-Path $candidate) {
    $c = Get-Content -Raw $candidate | ConvertFrom-Json
    Check 'candidate_price_is_500_nzd' ([int]$c.price -eq 500 -and $c.currency -eq 'nzd')
    Check 'candidate_is_approval_gated' ($c.approval_required -eq $true)
    Check 'candidate_checkout_is_disabled' ($c.checkout_available -eq $false)
    Check 'candidate_is_not_claimed_as_revenue' ($c.evidence.status -eq 'unproven' -and $null -eq $c.evidence.transaction_id)
}

if (Test-Path $frontDoor) {
    $html = Get-Content -Raw $frontDoor
    Check 'front_door_is_horizontal' ($html -match 'overflow-x:auto' -and $html -match 'scroll-snap-type:x')
    Check 'dreamy_make_account_is_top_right' ($html -match '/dreamiez/register.html' -and $html -match 'Make your Dreamy')
    Check 'mtg_is_silo_entry' ($html -match '/mtg' -and $html -match 'Independent silo')
}

$failed = @($checks | Where-Object status -eq 'FAIL')
$proofDir = Join-Path $root 'Proof\WealthEngine'
if (-not (Test-Path $proofDir)) { New-Item -ItemType Directory -Path $proofDir -Force | Out-Null }
$report = [ordered]@{
    schema_version = 'BEC-WEALTH-VERIFY-1.0'
    event = 'wealth_engine.verification'
    status = $(if ($failed.Count -eq 0) { 'PASS' } else { 'FAIL' })
    checks = $checks
    verified_at_utc = (Get-Date).ToUniversalTime().ToString('o')
}
$report | ConvertTo-Json -Depth 10 | Set-Content -Path (Join-Path $proofDir 'WEALTH-ENGINE-VERIFY.json') -Encoding UTF8

$checks | Format-Table -AutoSize
if ($failed.Count -gt 0) { exit 1 }
Write-Host 'VERIFY_PASS' -ForegroundColor Green
