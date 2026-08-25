#requires -Version 5.1
[CmdletBinding()]
param(
    [string]$CatalogPath = "$PSScriptRoot\..\catalog\offers.json",
    [string]$ProofPath = "$PSScriptRoot\..\Proof\ECONOMIC-COMMERCE-PROOF.json"
)
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Fail([string]$Message) { throw $Message }

if (-not (Test-Path -LiteralPath $CatalogPath)) { Fail "Catalog missing: $CatalogPath" }
$catalog = Get-Content -LiteralPath $CatalogPath -Raw | ConvertFrom-Json
if ($catalog.schema -ne "BEC-PRIME/OFFER-CATALOG/v1") { Fail "Unexpected catalog schema" }
if (-not $catalog.offers -or $catalog.offers.Count -lt 1) { Fail "No offers in catalog" }

$results = @()
foreach ($offer in $catalog.offers) {
    if ($offer.status -ne "APPROVED") { continue }
    if (-not $offer.checkout_available) { Fail "Approved offer has no checkout: $($offer.offer_id)" }
    if ([string]::IsNullOrWhiteSpace($offer.payment_link)) { Fail "Approved offer missing payment link: $($offer.offer_id)" }
    if ([string]::IsNullOrWhiteSpace($offer.stripe_product_id)) { Fail "Approved offer missing Stripe product: $($offer.offer_id)" }
    if ([string]::IsNullOrWhiteSpace($offer.stripe_price_id)) { Fail "Approved offer missing Stripe price: $($offer.offer_id)" }
    if ([int]$offer.price -le 0) { Fail "Approved offer has non-positive price: $($offer.offer_id)" }

    try {
        $r = Invoke-WebRequest -Uri $offer.payment_link -UseBasicParsing -TimeoutSec 20
        $http = [int]$r.StatusCode
    } catch {
        Fail "Checkout unreachable for $($offer.offer_id): $($_.Exception.Message)"
    }
    if ($http -lt 200 -or $http -ge 400) { Fail "Checkout HTTP $http for $($offer.offer_id)" }

    $results += [ordered]@{
        offer_id = $offer.offer_id
        silo = $offer.silo
        price_nzd = ([int]$offer.price / 100)
        checkout_http = $http
        payment_link_present = $true
        stripe_product_present = $true
        stripe_price_present = $true
    }
}

$dir = Split-Path -Parent $ProofPath
New-Item -ItemType Directory -Force -Path $dir | Out-Null
$proof = [ordered]@{
    timestamp = (Get-Date).ToString("o")
    catalog = (Resolve-Path $CatalogPath).Path
    approved_checkout_count = $results.Count
    offers = $results
    revenue_truth = "external_verified_payment_only"
    self_purchase_counts_as_revenue = $false
    public_outreach = "approval_gated"
    result = "PASS"
}
$proof | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $ProofPath -Encoding UTF8
$proof | ConvertTo-Json -Depth 8
