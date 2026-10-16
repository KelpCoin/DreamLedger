[CmdletBinding()]
param(
    [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
)

$ErrorActionPreference = 'Stop'
Set-Location $RepoRoot

$proofDir = Join-Path $RepoRoot 'data\proofs'
New-Item -ItemType Directory -Force -Path $proofDir | Out-Null
$proofPath = Join-Path $proofDir 'ECONOMIC-CONTRACT.json'

function Assert-True([bool]$Condition, [string]$Message) {
    if (-not $Condition) { throw "FAIL: $Message" }
    Write-Host "PASS: $Message"
}

$productPath = Join-Path $RepoRoot 'catalog\products\COMMANDER-DECK-DIAGNOSTIC-001.json'
$activationPath = Join-Path $RepoRoot 'scripts\Activate-FirstRevenue.ps1'
$offersPath = Join-Path $RepoRoot 'catalog\offers\offers.json'

Assert-True (Test-Path $productPath) 'canonical revenue product exists'
Assert-True (Test-Path $activationPath) 'first-revenue activation gate exists'
Assert-True (Test-Path $offersPath) 'compiled offer catalog exists'

$product = Get-Content $productPath -Raw | ConvertFrom-Json
$activation = Get-Content $activationPath -Raw
$offers = Get-Content $offersPath -Raw | ConvertFrom-Json

Assert-True ($product.id -eq 'COMMANDER-DECK-DIAGNOSTIC-001') 'canonical SKU is stable'
Assert-True ($product.silo -eq 'mtg') 'revenue SKU is MTG-silo isolated'
Assert-True ($product.currency -eq 'nzd') 'revenue currency is NZD'
Assert-True ([int]$product.price -eq 29 -and $product.price_unit -eq 'major') 'proposed price is NZD 29 in major units'
Assert-True ($product.status -eq 'held') 'canonical product remains held'
Assert-True ($product.checkout.mode -eq 'disabled') 'checkout remains disabled until proof gates pass'
Assert-True ($product.checkout_available -ne $true) 'checkout is not enabled'
Assert-True ($product.fulfillment.mode -eq 'disabled') 'fulfilment remains disabled until delivery is proven'
Assert-True ($product.commercial_truth.approval_required -eq $true -and $product.commercial_truth.sellable -eq $false) 'commercial authorization gate remains closed'
Assert-True ($null -eq $product.commercial_truth.payment_surface) 'held product exposes no active payment surface'
Assert-True ($product.evidence.status -eq 'awaiting_first_payment') 'payment evidence is still explicitly unproven'
Assert-True ($activation -match "price -ne $($product.price)") 'activation gate pins the current product price'
Assert-True ($activation -match "currency -ne 'nzd'") 'activation gate pins NZD currency'
Assert-True ($null -ne $offers.approval_rule) 'offer catalog has an approval rule'

$priceNzd = if ($product.price_unit -eq 'major') { [math]::Round([double]$product.price, 2) } else { [math]::Round(([double]$product.price / 100), 2) }
$proof = [ordered]@{
    type = 'dreamledger-economic-contract'
    status = 'PASS'
    generated_at_utc = (Get-Date).ToUniversalTime().ToString('o')
    canonical_sku = $product.id
    silo = $product.silo
    price_minor = [int][math]::Round($priceNzd * 100)
    price_nzd = $priceNzd
    checkout_enabled = ($product.checkout_available -eq $true)
    economic_state = 'HELD_PENDING_INDEPENDENT_PAYMENT_AND_DELIVERY_PROOF'
    currency = $product.currency
    checkout_mode = $product.checkout.mode
    checkout_enabled = ($product.checkout_available -eq $true)
    economic_state = 'HELD_PENDING_INDEPENDENT_PAYMENT_AND_DELIVERY_PROOF'
    payment_surface = $product.commercial_truth.payment_surface
    payment_truth = 'AWAITING_FIRST_PAYMENT'
    first_revenue_gate = 'SIGNED_STRIPE_PAYMENT_WEBHOOK'
    public_promotion = 'NOT_PERFORMED'
    approval_boundary = 'PRESERVED_FOR_GENERATED_OFFERS'
    proof_path = 'data/proofs/ECONOMIC-CONTRACT.json'
}

$proof | ConvertTo-Json -Depth 10 | Set-Content $proofPath -Encoding utf8
Write-Host "PROOF: $proofPath"
