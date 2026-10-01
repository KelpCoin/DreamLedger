param(
    [string]$RepoRoot = (Get-Location).Path
)

$ErrorActionPreference = 'Stop'
$manifest = Join-Path $RepoRoot 'BEC-PRIME/cube/CUBE-MONEY-FLEET.json'
if (-not (Test-Path $manifest)) { throw "Missing CUBE-MONEY-FLEET.json" }

$x = Get-Content $manifest -Raw | ConvertFrom-Json
$expected = @('mtg','crypto','media_music','digital_products')
$ids = @($x.silos | ForEach-Object { $_.id })
$missing = @($expected | Where-Object { $_ -notin $ids })
if ($missing.Count -gt 0) { throw "Missing silos: $($missing -join ', ')" }
if ($x.neutral_host -ne 'dreamledger') { throw 'DreamLedger neutrality failed' }
if ($x.activation_requires_payment_rail -ne $true) { throw 'Payment rail gate failed' }
if ($x.revenue_claim_requires_verified_payment -ne $true) { throw 'Revenue evidence gate failed' }
if ($x.isolation.cross_silo_offers -ne $false) { throw 'Cross-silo offer isolation failed' }
if ($x.isolation.dreamledger_brand_neutral -ne $true) { throw 'DreamLedger neutrality flag failed' }

$proof = [ordered]@{
    schema = 'BEC-PROOF-CUBE-MONEY-FLEET-1.0'
    status = 'PASS'
    verified_utc = (Get-Date).ToUniversalTime().ToString('o')
    silos = $expected
    neutral_host = 'dreamledger'
    cross_silo_offers = $false
    revenue_claim_requires_verified_payment = $true
}
$out = Join-Path $RepoRoot 'BEC-PRIME/PROOF-CUBE-MONEY-FLEET.json'
$proof | ConvertTo-Json -Depth 10 | Set-Content -Encoding UTF8 $out
Write-Host "PASS: CUBE four-silo money fleet verified"
Write-Host "Proof: $out"
