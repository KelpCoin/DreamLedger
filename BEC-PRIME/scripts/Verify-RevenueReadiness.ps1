[CmdletBinding()]
param(
    [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
)

$ErrorActionPreference = 'Stop'
Set-Location $RepoRoot

$proofDir = Join-Path $RepoRoot 'data\proofs'
New-Item -ItemType Directory -Force -Path $proofDir | Out-Null
$proofPath = Join-Path $proofDir 'REVENUE-READINESS.json'

function Assert-True([bool]$Condition, [string]$Message) {
    if (-not $Condition) { throw "FAIL: $Message" }
    Write-Host "PASS: $Message"
}

$productPath = Join-Path $RepoRoot 'catalog\products\COMMANDER-DECK-DIAGNOSTIC-001.json'
$product = Get-Content $productPath -Raw | ConvertFrom-Json
$approvedPath = Join-Path $RepoRoot 'catalog\offers\approved.json'
$approved = Get-Content $approvedPath -Raw | ConvertFrom-Json
$offersPath = Join-Path $RepoRoot 'catalog\offers\offers.json'
$compiled = Get-Content $offersPath -Raw | ConvertFrom-Json
$featuredPath = Join-Path $RepoRoot 'catalog\featured-offer.json'
$featured = Get-Content $featuredPath -Raw | ConvertFrom-Json
$registryPath = Join-Path $RepoRoot 'fulfillment\PRODUCT-FULFILLMENT-REGISTRY.json'
$registry = Get-Content $registryPath -Raw | ConvertFrom-Json
$offerId = 'OFFER-CMD-DIAG-29-NZD'
$productId = 'COMMANDER-DECK-DIAGNOSTIC-001'

Assert-True ($product.id -eq $productId) 'canonical Commander diagnostic product exists'
Assert-True ($product.silo -eq 'mtg') 'Commander diagnostic remains inside the MTG silo'
Assert-True ($product.status -eq 'held') 'Commander diagnostic is held until delivery is durable'
Assert-True ([math]::Round([double]$product.price, 2) -eq 29 -and $product.price_unit -eq 'major') 'NZ$29 is recorded as a major-unit reference price'
Assert-True ($product.currency -eq 'nzd') 'canonical currency is NZD'
Assert-True ($product.checkout.mode -eq 'disabled' -and $null -eq $product.checkout.url) 'Commander checkout is disabled and exposes no URL'
Assert-True ($product.commercial_truth.sellable -eq $false -and $product.commercial_truth.approval_required -eq $true) 'commercial truth denies sale until explicitly cleared'
Assert-True ($product.fulfillment.mode -eq 'disabled' -and $product.fulfillment.operator_required -eq $true) 'fulfillment is not falsely marked automated'
Assert-True ($null -eq $product.commercial_truth.payment_surface) 'product record does not expose a payment surface'

$approvedCommander = @($approved.approved | Where-Object { $_.offer_id -eq $offerId })
$heldCommander = @($approved.held | Where-Object { $_.offer_id -eq $offerId })
Assert-True ($approvedCommander.Count -eq 0) 'held Commander offer is excluded from approved checkout catalog'
Assert-True ($heldCommander.Count -eq 1 -and $null -eq $heldCommander[0].payment_link_url) 'held Commander offer remains auditable without a payment URL'
$compiledCommander = @($compiled.offers | Where-Object { $_.offer_id -eq $offerId })
Assert-True (@($compiledCommander | Where-Object { $_.checkout_available -eq $true -or $_.status -eq 'VERIFIED_AVAILABLE' -or $_.checkout_url -or $_.payment_link_url }).Count -eq 0) 'compiled catalogue cannot advertise Commander as purchasable'
Assert-True ($featured.status -eq 'HELD' -and $null -eq $featured.payment_link_url -and $null -eq $featured.checkout_url) 'featured offer does not expose a Commander payment URL'

$fulfillment = $registry.entries.$productId
Assert-True ($fulfillment.ready -eq $false -and $fulfillment.operator_required -eq $true) 'fulfillment registry agrees that delivery is not ready'

$proof = [ordered]@{
    type = 'dreamledger-revenue-readiness'
    status = 'HOLD'
    generated_at_utc = (Get-Date).ToUniversalTime().ToString('o')
    reference_price_nzd = 29
    checkout_enabled = $false
    verified_revenue_nzd = 0
    independent_buyers_verified = 0
    completed_deliveries_verified = 0
    canonical_product_id = $productId
    canonical_offer_id = $offerId
    release_status = 'HELD_DURABLE_FULFILLMENT_UNVERIFIED'
    payment_truth = 'NO_VERIFIED_REVENUE'
    public_promotion = 'NOT_PERFORMED'
    approval_gate = 'PRESERVED'
    mtg_silo = 'ISOLATED'
    next_economic_gate = 'RESTORE_DATABASE_OBSERVABILITY_AND_PROVE_DURABLE_DELIVERY'
    proof_path = 'data/proofs/REVENUE-READINESS.json'
}

$proof | ConvertTo-Json -Depth 10 | Set-Content $proofPath -Encoding utf8
Write-Host 'REVENUE_READINESS=HOLD'
Write-Host "PROOF: $proofPath"
