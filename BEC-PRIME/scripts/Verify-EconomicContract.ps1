[CmdletBinding()]
param([string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path)
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
$approvedPath = Join-Path $RepoRoot 'catalog\offers\approved.json'
$registryPath = Join-Path $RepoRoot 'fulfillment\PRODUCT-FULFILLMENT-REGISTRY.json'
foreach ($path in @($productPath,$activationPath,$offersPath,$approvedPath,$registryPath)) {
    Assert-True (Test-Path $path) "required economic control exists: $([IO.Path]::GetFileName($path))"
}
$product = Get-Content $productPath -Raw | ConvertFrom-Json
$activation = Get-Content $activationPath -Raw
$offers = Get-Content $offersPath -Raw | ConvertFrom-Json
$approved = Get-Content $approvedPath -Raw | ConvertFrom-Json
$registry = Get-Content $registryPath -Raw | ConvertFrom-Json
Assert-True ($product.id -eq 'COMMANDER-DECK-DIAGNOSTIC-001') 'canonical product identity is stable'
Assert-True ($product.silo -eq 'mtg') 'Commander Diagnostic remains MTG-silo isolated'
Assert-True ($product.currency -eq 'nzd') 'currency is NZD'
Assert-True ([decimal]$product.price -eq 29 -and $product.price_unit -eq 'major') 'reference price is NZD 29 in major units'
Assert-True ($product.status -eq 'held') 'product stays held until durable delivery is verified'
Assert-True ($product.checkout.mode -eq 'disabled' -and $null -eq $product.checkout.url) 'checkout remains disabled and exposes no URL'
Assert-True ($product.commercial_truth.approval_required -eq $true -and $product.commercial_truth.sellable -eq $false) 'commercial truth remains approval-blocked and unsellable'
Assert-True ($null -eq $product.commercial_truth.payment_surface) 'product exposes no payment surface'
Assert-True ($product.fulfillment.mode -eq 'disabled' -and $product.fulfillment.operator_required -eq $true) 'fulfillment is not falsely represented as automated'
Assert-True ($product.evidence.status -eq 'awaiting_first_payment' -and $null -eq $product.evidence.transaction_id) 'first-payment evidence remains unproven'
$approvedCommander = @($approved.approved | Where-Object { $_.offer_id -eq 'OFFER-CMD-DIAG-29-NZD' })
$heldCommander = @($approved.held | Where-Object { $_.offer_id -eq 'OFFER-CMD-DIAG-29-NZD' })
Assert-True ($approvedCommander.Count -eq 0) 'held Commander Diagnostic is excluded from approved checkout offers'
Assert-True ($heldCommander.Count -eq 1 -and $heldCommander[0].status -eq 'HELD' -and $null -eq $heldCommander[0].payment_link_url) 'held Commander offer remains auditable without payment URL'
$compiledCommander = @($offers.offers | Where-Object { $_.offer_id -eq 'OFFER-CMD-DIAG-29-NZD' })
Assert-True (@($compiledCommander | Where-Object { $_.checkout_available -eq $true -or $_.status -eq 'VERIFIED_AVAILABLE' -or $_.checkout_url -or $_.payment_link_url }).Count -eq 0) 'compiled catalog cannot make the held Commander offer purchasable'
$commanderFulfillment = $registry.entries.'COMMANDER-DECK-DIAGNOSTIC-001'
Assert-True ($commanderFulfillment.ready -eq $false -and $commanderFulfillment.operator_required -eq $true) 'fulfillment registry records the Commander hold'
if (-not $activation.Contains('HOLD_UNTIL_DURABLE_FULFILLMENT_AND_SETTLEMENT_PROOF')) {
    throw 'FAIL: first-revenue activation script must fail closed without durable delivery and settlement proof'
}
Assert-True (-not $activation.Contains('$product.commercial_truth.approval_required = $false')) 'activation script cannot silently remove the approval hold'
$proof = [ordered]@{
    type = 'dreamledger-economic-contract'
    status = 'PASS'
    economic_release_status = 'HOLD'
    generated_at_utc = (Get-Date).ToUniversalTime().ToString('o')
    canonical_sku = $product.id
    silo = $product.silo
    reference_price_nzd = [decimal]$product.price
    price_unit = 'major'
    currency = $product.currency
    checkout_mode = $product.checkout.mode
    payment_truth = 'NO_VERIFIED_REVENUE'
    verified_revenue_nzd = 0
    first_revenue_gate = 'DURABLE_DELIVERY_AND_AUTHORITATIVE_SETTLEMENT'
    public_promotion = 'NOT_PERFORMED'
    approval_boundary = 'PRESERVED'
    proof_path = 'data/proofs/ECONOMIC-CONTRACT.json'
}
$proof | ConvertTo-Json -Depth 10 | Set-Content $proofPath -Encoding utf8
Write-Host "PROOF: $proofPath"
Write-Host 'ECONOMIC_CONTRACT=PASS_TECHNICAL_ONLY'
Write-Host 'ECONOMIC_RELEASE=HOLD'
