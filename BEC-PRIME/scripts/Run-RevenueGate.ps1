$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$root = Join-Path $PSScriptRoot '..'
$gauntlet = Join-Path $root 'scripts\Run-EconomicGate.ps1'
$offerGate = Join-Path $root 'scripts\Gauntlet-Offers.ps1'
$proofDir = Join-Path $root 'Proof\RevenueGate'
$proofPath = Join-Path $proofDir 'REVENUE-GATE-LATEST.json'
$economicPath = Join-Path $root 'Proof\EconomicGate\ECONOMIC-GATE-LATEST.json'

foreach ($path in @($gauntlet, $offerGate)) {
    if (-not (Test-Path $path)) { throw "Missing required gate: $path" }
}
New-Item -ItemType Directory -Path $proofDir -Force | Out-Null

& $offerGate
if ($LASTEXITCODE -ne 0) { throw 'Canonical offer gate failed.' }

& $gauntlet
if ($LASTEXITCODE -ne 0) { throw 'Economic gate failed.' }

if (-not (Test-Path $economicPath)) { throw "Missing economic gate proof: $economicPath" }
$economic = Get-Content -Raw $economicPath | ConvertFrom-Json

$decision = 'NO_AUTOMATIC_PUBLISH'
$top = $null
if ($economic.ranked_offers.Count -gt 0) { $top = $economic.ranked_offers[0] }
if ($null -ne $top -and $top.recommendation -eq 'SURVIVE') {
    $decision = 'CANDIDATE_READY_FOR_OPERATOR_APPROVAL'
}

$proof = [ordered]@{
    schema_version = 'BEC-REVENUE-GATE-1.0'
    event = 'revenue_gate.completed'
    status = 'PASS'
    decision = $decision
    publish_policy = 'NEVER_ENABLE_CHECKOUT_AUTOMATICALLY'
    objective = 'maximize_expected_net_cash_with_minimum_human_load'
    economic_gate = $economic
    checked_at_utc = (Get-Date).ToUniversalTime().ToString('o')
}

$proof | ConvertTo-Json -Depth 40 | Set-Content -Path $proofPath -Encoding UTF8
Write-Host "REVENUE_GATE=PASS"
Write-Host "DECISION=$decision"
if ($null -ne $top) { Write-Host "TOP=$($top.offer_id) SCORE=$($top.score) EXPECTED_NET_CASH_NZD=$($top.expected_net_cash_nzd)" }
Write-Host "PROOF=$proofPath"
