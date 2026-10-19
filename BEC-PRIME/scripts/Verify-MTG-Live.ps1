#requires -Version 5.1
[CmdletBinding()]
param([string]$BaseUrl='https://dreamledger.org')
$ErrorActionPreference='Stop'

# The approved offer catalogue is the canonical commercial source.
# This verifier checks public-surface consistency only; it does not prove
# settlement, fulfillment, delivery, or revenue.
$root = Split-Path -Parent $PSScriptRoot
$approvedPath = Join-Path $root 'catalog\offers\approved.json'
if (-not (Test-Path -LiteralPath $approvedPath)) {
    throw "Canonical approved-offer catalogue missing: $approvedPath"
}
$approved = Get-Content -LiteralPath $approvedPath -Raw | ConvertFrom-Json
$offer = @($approved.approved | Where-Object { $_.offer_id -eq 'OFFER-CMD-DIAG-29-NZD' }) | Select-Object -First 1
if (-not $offer) { throw 'Canonical Commander Deck Diagnostic offer missing from approved catalogue.' }
if ([string]$offer.product_id -ne 'COMMANDER-DECK-DIAGNOSTIC-001') { throw 'Canonical product ID mismatch in approved catalogue.' }
if ([string]$offer.currency -ne 'NZD') { throw "Unsupported canonical currency: $($offer.currency)" }
$price = [decimal]$offer.price
if ($price -le 0) { throw 'Canonical offer price must be positive.' }
$priceText = [string]::Format([Globalization.CultureInfo]::InvariantCulture, '{0:0.##}', $price)
$pricePattern = '(?i)(?:NZD\s*\$' + [regex]::Escape($priceText) + '|NZ\$\s*' + [regex]::Escape($priceText) + '|\$' + [regex]::Escape($priceText) + '\s*NZD)'

$base = $BaseUrl.TrimEnd('/')
$pageUrl = $base + '/commander-diagnostic.html'
$p = Invoke-WebRequest -Uri $pageUrl -UseBasicParsing -TimeoutSec 20
if ([int]$p.StatusCode -ne 200) { throw "Sales page failed: HTTP $($p.StatusCode)" }
if ($p.Content -notmatch $pricePattern) { throw "Price mismatch: canonical $($offer.currency) $priceText not found on $pageUrl." }
if ($p.Content -notmatch [regex]::Escape([string]$offer.product_id)) { throw 'Canonical product ID missing from sales-page checkout wiring.' }

$apiUrl = $base + '/api/marketplace?silo=mtg'
$api = Invoke-WebRequest -Uri $apiUrl -UseBasicParsing -TimeoutSec 20
if ([int]$api.StatusCode -ne 200) { throw "Marketplace API failed: HTTP $($api.StatusCode)" }
$data = $api.Content | ConvertFrom-Json
$mtg = @($data.products | Where-Object { $_.id -eq [string]$offer.product_id }) | Select-Object -First 1
if (-not $mtg) { throw 'Canonical MTG product is not visible in the published marketplace.' }
if (-not $mtg.checkout_available) { throw 'Product is visible but checkout_available=false. Payment rail is not ready.' }
if ([decimal]$mtg.price -ne $price) { throw "Marketplace price is $($mtg.price), canonical approved price is $price." }
if ([string]$mtg.currency -and [string]$mtg.currency -ine 'nzd') { throw "Marketplace currency mismatch: $($mtg.currency)." }

$proof = [ordered]@{
    status = 'PASS'
    verification_scope = 'public_surface_and_catalogue_consistency_only'
    timestamp_utc = (Get-Date).ToUniversalTime().ToString('o')
    sales_page = $pageUrl
    marketplace_api = $apiUrl
    offer_id = [string]$offer.offer_id
    product_id = [string]$offer.product_id
    price_nzd = $price
    checkout_available = [bool]$mtg.checkout_available
    delivery_test_status = 'UNVERIFIED'
    commercial_validation_status = 'UNVALIDATED'
    verified_revenue_nzd = 0
    payment_proof_required = $true
    fulfillment_proof_required = $true
}
$dir = 'D:\BrownEyeCortex\Proof\Fossils'
New-Item -ItemType Directory -Force -Path $dir | Out-Null
$file = Join-Path $dir ('MTG-LIVE-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.json')
$proof | ConvertTo-Json -Depth 10 | Set-Content -Encoding UTF8 $file
Write-Host "PASS: public surface matches the approved NZD $price offer. This is not payment, delivery, or revenue proof. Proof: $file"
