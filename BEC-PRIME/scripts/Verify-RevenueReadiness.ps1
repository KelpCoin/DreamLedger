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

$required = @(
    'catalog\products\COMMANDER-DECK-DIAGNOSTIC-001.json',
    'catalog\offers\offers.json',
    'catalog\offers\approved.json',
    'scripts\Activate-FirstRevenue.ps1'
)

foreach ($path in $required) {
    Assert-True (Test-Path (Join-Path $RepoRoot $path)) "required file exists: $path"
}

$productPath = Join-Path $RepoRoot 'catalog\products\COMMANDER-DECK-DIAGNOSTIC-001.json'
$product = Get-Content $productPath -Raw | ConvertFrom-Json

Assert-True ($product.id -eq 'COMMANDER-DECK-DIAGNOSTIC-001') 'canonical Commander diagnostic SKU is present'
Assert-True ($product.silo -eq 'mtg') 'Commander diagnostic remains in MTG silo'
Assert-True ($product.status -eq 'published') 'Commander diagnostic is published in the internal catalog'
Assert-True ([int]$product.price -gt 0) 'Commander diagnostic has a positive price'
Assert-True ($product.currency -eq 'nzd') 'Commander diagnostic currency is NZD'
Assert-True ($product.checkout.mode -eq 'payment') 'Commander diagnostic uses payment checkout mode'
Assert-True ($product.delivery.type -eq 'digital_report') 'Commander diagnostic has defined digital fulfilment'
Assert-True ($product.evidence.status -eq 'awaiting_first_payment') 'revenue truth remains unproven until first payment'

$offerCatalogPath = Join-Path $RepoRoot 'catalog\offers\offers.json'
$offerCatalog = Get-Content $offerCatalogPath -Raw | ConvertFrom-Json
Assert-True ($offerCatalog.approval_rule -match 'approval') 'offer catalog is approval-gated'

$approvedPath = Join-Path $RepoRoot 'catalog\offers\approved.json'
$approved = Get-Content $approvedPath -Raw | ConvertFrom-Json
Assert-True ($null -ne $approved.approved) 'approved-offer registry exists'

$proof = [ordered]@{
    type = 'dreamledger-revenue-readiness'
    status = 'PASS'
    generated_at_utc = (Get-Date).ToUniversalTime().ToString('o')
    first_revenue_target_nzd = 29
    verified_revenue_nzd = 0
    canonical_activation_sku = $product.id
    canonical_activation_price_nzd = [math]::Round(([int]$product.price / 100), 2)
    payment_truth = 'AWAITING_FIRST_PAYMENT'
    public_promotion = 'NOT_PERFORMED'
    approval_gate = 'PRESERVED'
    mtg_silo = 'ISOLATED'
    next_economic_gate = 'SIGNED_STRIPE_PAYMENT_WEBHOOK'
    proof_path = 'data/proofs/REVENUE-READINESS.json'
}

$proof | ConvertTo-Json -Depth 10 | Set-Content $proofPath -Encoding utf8
Write-Host "PROOF: $proofPath"
