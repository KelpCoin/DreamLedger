[CmdletBinding()]
param([string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path)
$ErrorActionPreference = 'Stop'
Set-Location $RepoRoot
$proofDir = Join-Path $RepoRoot 'data\proofs'
New-Item -ItemType Directory -Force -Path $proofDir | Out-Null
$proofPath = Join-Path $proofDir 'FIRST-REVENUE-ACTIVATION-GATE.json'
$productPath = Join-Path $RepoRoot 'catalog\products\COMMANDER-DECK-DIAGNOSTIC-001.json'
$approvedPath = Join-Path $RepoRoot 'catalog\offers\approved.json'
$registryPath = Join-Path $RepoRoot 'fulfillment\PRODUCT-FULFILLMENT-REGISTRY.json'
foreach ($path in @($productPath,$approvedPath,$registryPath)) {
    if (-not (Test-Path $path)) { throw "Missing activation evidence input: $path" }
}
$product = Get-Content $productPath -Raw | ConvertFrom-Json
$approved = Get-Content $approvedPath -Raw | ConvertFrom-Json
$registry = Get-Content $registryPath -Raw | ConvertFrom-Json
$approvedOffer = @($approved.approved | Where-Object { $_.offer_id -eq 'OFFER-CMD-DIAG-29-NZD' })
$heldOffer = @($approved.held | Where-Object { $_.offer_id -eq 'OFFER-CMD-DIAG-29-NZD' })
$fulfillment = $registry.entries.'COMMANDER-DECK-DIAGNOSTIC-001'
# This gate is intentionally non-mutating. Static checks, link history, and LLM agreement do not prove delivery.
$proof = [ordered]@{
    type = 'dreamledger-first-revenue-activation-gate'
    schema_version = '2.0'
    status = 'HOLD'
    generated_at_utc = (Get-Date).ToUniversalTime().ToString('o')
    sku = 'COMMANDER-DECK-DIAGNOSTIC-001'
    reference_price_nzd = 29
    checkout_enabled = $false
    verified_revenue_nzd = 0
    independent_buyer_verified = $false
    payment_settlement_verified = $false
    durable_fulfillment_verified = $false
    delivery_proof_verified = $false
    gate_checks = [ordered]@{
        product_is_held = ($product.status -eq 'held')
        checkout_is_disabled = ($product.checkout.mode -eq 'disabled' -and $null -eq $product.checkout.url)
        offer_is_not_approved = ($approvedOffer.Count -eq 0)
        held_offer_has_no_payment_url = ($heldOffer.Count -eq 1 -and $null -eq $heldOffer[0].payment_link_url)
        fulfillment_not_claimed_ready = ($null -ne $fulfillment -and $fulfillment.ready -eq $false)
    }
    activation_decision = 'HOLD_UNTIL_DURABLE_FULFILLMENT_AND_SETTLEMENT_PROOF'
    mutation_performed = $false
    note = 'No product, offer, checkout, secret, database, or deployment state is changed by this gate.'
    proof_path = 'data/proofs/FIRST-REVENUE-ACTIVATION-GATE.json'
}
$proof | ConvertTo-Json -Depth 12 | Set-Content $proofPath -Encoding utf8
$proof | ConvertTo-Json -Depth 12
Write-Host 'ACTIVATION_GATE=HOLD'
Write-Host "PROOF=$proofPath"
Write-Host 'MUTATION_PERFORMED=FALSE'
