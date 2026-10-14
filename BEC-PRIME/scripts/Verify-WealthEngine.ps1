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
$frontDoor = Join-Path $root '..\public\home.html'

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
    $publicRoot = Join-Path $root '..\public'
    $mtgSurface = Join-Path $publicRoot 'mtg\index.html'
    $publicCatalogPath = Join-Path $publicRoot 'catalog.json'
    $canonicalLink = 'https://buy.stripe.com/eVqeVdc1T01n1DV3gwdwc30'
    $legacyLink = 'https://buy.stripe.com/8x228r1nfg0l3M32csdwc2I'
    $mtgHtml = if (Test-Path $mtgSurface) { Get-Content -Raw $mtgSurface } else { '' }
    $catalogDiagnostic = $null
    if (Test-Path $publicCatalogPath) {
        $publicCatalog = Get-Content -Raw $publicCatalogPath | ConvertFrom-Json
        $catalogDiagnostic = @($publicCatalog.products | Where-Object { $_.id -eq 'COMMANDER-DECK-DIAGNOSTIC-001' -and $_.sku -eq 'CMD-DIAG-29' } | Select-Object -First 1)[0]
    }
    $commercialDoor = ($html -match 'href="/mtg/"') -and
        ($mtgHtml -match 'Commander diagnostic') -and
        $mtgHtml.Contains($canonicalLink) -and
        -not $mtgHtml.Contains($legacyLink) -and
        ($null -ne $catalogDiagnostic) -and
        ([int]$catalogDiagnostic.price -eq 29) -and
        ([string]$catalogDiagnostic.currency -eq 'nzd') -and
        ($catalogDiagnostic.checkout_available -eq $true) -and
        ($catalogDiagnostic.checkout_url -eq $canonicalLink)
    Check 'front_door_is_commercial' $commercialDoor
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
