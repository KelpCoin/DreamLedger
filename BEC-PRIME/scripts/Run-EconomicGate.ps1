$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$root = Join-Path $PSScriptRoot '..'
$engine = Join-Path $root 'gauntlet\EconomicGateV1.js'
$offerFile = Join-Path $root 'catalog\offers\offers.json'
$proofDir = Join-Path $root 'Proof\EconomicGate'
$proofPath = Join-Path $proofDir 'ECONOMIC-GATE-LATEST.json'

foreach ($path in @($engine, $offerFile)) {
    if (-not (Test-Path $path)) { throw "Missing required file: $path" }
}
New-Item -ItemType Directory -Path $proofDir -Force | Out-Null

$raw = & node $engine 2>&1
if ($LASTEXITCODE -ne 0) {
    throw "Economic gate failed with exit code $LASTEXITCODE`n$($raw -join "`n")"
}

$dataPath = Join-Path $root 'data\economic-gate\ECONOMIC-GATE-LATEST.json'
if (-not (Test-Path $dataPath)) { throw "Economic gate did not produce $dataPath" }

Copy-Item -LiteralPath $dataPath -Destination $proofPath -Force

$data = Get-Content -Raw $proofPath | ConvertFrom-Json
Write-Host "ECONOMIC_GATE=$($data.status)"
Write-Host "OFFERS=$($data.counts.offers) SURVIVE=$($data.counts.survive) REFINE=$($data.counts.refine) KILL=$($data.counts.kill)"
if ($data.ranked_offers.Count -gt 0) {
    $top = $data.ranked_offers[0]
    Write-Host "TOP_OFFER=$($top.offer_id) SCORE=$($top.score) EXPECTED_NET_CASH_NZD=$($top.expected_net_cash_nzd)"
}
Write-Host "PROOF=$proofPath"
