#requires -Version 5.1
[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$root = Join-Path $PSScriptRoot '..'
$offersFile = Join-Path $root 'catalog\offers\offers.json'
$approvedFile = Join-Path $root 'catalog\offers\approved.json'
$capabilitiesFile = Join-Path $root 'catalog\ip-capabilities.json'
$productDir = Join-Path $root 'catalog\products'
$fulfillmentFile = Join-Path $root 'fulfillment\PRODUCT-FULFILLMENT-REGISTRY.json'
$proofFile = Join-Path $root 'PROOF-OFFER-COMPILATION.json'

foreach ($file in @($offersFile, $approvedFile, $capabilitiesFile, $fulfillmentFile)) {
    if (-not (Test-Path -LiteralPath $file)) { throw "Missing required file: $file" }
}

$offers = Get-Content -Raw -LiteralPath $offersFile | ConvertFrom-Json
$approvedCatalog = Get-Content -Raw -LiteralPath $approvedFile | ConvertFrom-Json
$catalog = Get-Content -Raw -LiteralPath $capabilitiesFile | ConvertFrom-Json
$fulfillmentRegistry = Get-Content -Raw -LiteralPath $fulfillmentFile | ConvertFrom-Json

$errors = New-Object System.Collections.Generic.List[string]
$validIds = @($catalog.capabilities | ForEach-Object { $_.id })
$approvedRecords = @($approvedCatalog.approved)
$compiledRecords = @($offers.offers)
$compiledById = @{}

if ($offers.schema -ne 'BEC-PRIME/OFFER-CATALOG/v1') { $errors.Add('offers schema mismatch') }
if ($offers.compiler -ne 'offer-compiler-v1') { $errors.Add('compiler version mismatch') }

foreach ($offer in $compiledRecords) {
    if ([string]::IsNullOrWhiteSpace([string]$offer.offer_id)) {
        $errors.Add('compiled offer missing offer_id')
        continue
    }
    if ($compiledById.ContainsKey([string]$offer.offer_id)) {
        $errors.Add("duplicate compiled offer id: $($offer.offer_id)")
        continue
    }
    $compiledById[[string]$offer.offer_id] = $offer
}

foreach ($record in $approvedRecords) {
    $id = [string]$record.offer_id
    if ([string]::IsNullOrWhiteSpace($id)) {
        $errors.Add('approved record missing offer_id')
        continue
    }
    if (-not $compiledById.ContainsKey($id)) {
        $errors.Add("approved offer missing from compiled catalog: $id")
        continue
    }
    $offer = $compiledById[$id]
    if ($offer.silo -ne $record.silo) { $errors.Add("${id}: silo mismatch between approved source and compiled catalog") }
    if ([double]$offer.price -ne [double]$record.price) { $errors.Add("${id}: price mismatch between approved source and compiled catalog") }
    if ([string]$offer.currency -ne [string]$record.currency) { $errors.Add("${id}: currency mismatch between approved source and compiled catalog") }
    if ($offer.capability_id -notin $validIds) { $errors.Add("${id}: compiled capability is not present in capability catalog") }

    # Approval identifies the proposed offer; it does not override canonical
    # product, provider-link, inventory or fulfillment readiness.
    $product = $null
    $productPath = Join-Path $productDir ($([string]$record.product_id) + '.json')
    if (Test-Path -LiteralPath $productPath) {
        try { $product = Get-Content -Raw -LiteralPath $productPath | ConvertFrom-Json } catch { $product = $null }
    }
    $fulfillment = $null
    if ($null -ne $fulfillmentRegistry.entries) {
        $fulfillment = $fulfillmentRegistry.entries.$id
        if ($null -eq $fulfillment -and $record.product_id) { $fulfillment = $fulfillmentRegistry.entries.([string]$record.product_id) }
        if ($null -eq $fulfillment -and $null -ne $product) { $fulfillment = $fulfillmentRegistry.entries.([string]$product.id) }
    }
    $canonicalLink = $null
    if ($null -ne $product) {
        $canonicalLink = $product.commercial_truth.payment_link
        if ([string]::IsNullOrWhiteSpace([string]$canonicalLink)) { $canonicalLink = $product.checkout.url }
        if ([string]::IsNullOrWhiteSpace([string]$canonicalLink)) { $canonicalLink = $product.checkout_url }
    }
    $inventoryOkay = $true
    if ($null -ne $product -and $product.PSObject.Properties.Name -contains 'inventory') {
        $inventoryOkay = [double]$product.inventory -ge 1
    }
    $canonicalOpen = (
        $null -ne $product -and
        $product.id -eq $record.product_id -and
        $product.status -eq 'published' -and
        $product.commercial_truth.approval_required -eq $false -and
        $product.commercial_truth.sellable -eq $true -and
        $product.checkout.mode -ne 'disabled' -and
        $inventoryOkay -and
        $null -ne $fulfillment -and
        $fulfillment.ready -eq $true -and
        $fulfillment.operator_required -eq $false -and
        $canonicalLink -eq $record.payment_link_url -and
        $record.payment_link_status -eq 'ACTIVE_LIVEMODE' -and
        [string]$record.payment_link_url -match '^https://(buy|checkout)\.stripe\.com/' -and
        [double]$product.price -eq [double]$record.price -and
        ([string]$product.currency).ToUpperInvariant() -eq ([string]$record.currency).ToUpperInvariant()
    )

    if ($canonicalOpen) {
        if ($offer.approval_required -ne $false) { $errors.Add("${id}: canonical-open product must compile with approval_required=false") }
        if ($offer.checkout_available -ne $true) { $errors.Add("${id}: canonical-open product must compile checkout_available=true") }
        if ($offer.status -ne 'VERIFIED_AVAILABLE') { $errors.Add("${id}: canonical-open product status must be VERIFIED_AVAILABLE") }
        if ($offer.payment_link_url -ne $record.payment_link_url) { $errors.Add("${id}: compiled payment link differs from canonical source") }
        if ([string]::IsNullOrWhiteSpace([string]$offer.fulfillment_route)) { $errors.Add("${id}: open offer has no fulfillment route") }
    } else {
        if ($offer.approval_required -ne $true) { $errors.Add("${id}: gated product must compile with approval_required=true") }
        if ($offer.checkout_available -ne $false) { $errors.Add("${id}: gated product must compile checkout_available=false") }
        if (-not ([string]$offer.status).StartsWith('HELD_')) { $errors.Add("${id}: gated product must compile with a HELD_ status") }
        if (-not [string]::IsNullOrWhiteSpace([string]$offer.payment_link_url)) { $errors.Add("${id}: held offer leaks a payment link") }
        if (-not [string]::IsNullOrWhiteSpace([string]$offer.fulfillment_route)) { $errors.Add("${id}: held offer exposes a fulfillment route") }
        if ([string]::IsNullOrWhiteSpace([string]$offer.checkout_disabled_reason)) { $errors.Add("${id}: held offer lacks a reason") }
    }
}

if ($approvedRecords.Count -eq 0) { $errors.Add('approved catalog contains zero records') }

if ($errors.Count -gt 0) {
    $proof = [ordered]@{
        type = 'dreamledger-offer-compilation-proof'
        status = 'FAIL'
        verified_at = (Get-Date).ToUniversalTime().ToString('o')
        approved_count = $approvedRecords.Count
        compiled_count = $compiledRecords.Count
        errors = @($errors)
    }
    $proof | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $proofFile -Encoding UTF8
    $errors | ForEach-Object { Write-Host "FAIL: $_" -ForegroundColor Red }
    exit 1
}

$proof = [ordered]@{
    type = 'dreamledger-offer-compilation-proof'
    status = 'PASS'
    verified_at = (Get-Date).ToUniversalTime().ToString('o')
    approved_count = $approvedRecords.Count
    compiled_count = $compiledRecords.Count
    approved_offer_ids = @($approvedRecords | ForEach-Object { $_.offer_id })
    canonical_open_count = @($approvedRecords | Where-Object { $compiledById[$_.offer_id].checkout_available -eq $true }).Count
    held_count = @($approvedRecords | Where-Object { $compiledById[$_.offer_id].checkout_available -eq $false }).Count
    contract = 'explicit approval nominates an offer; canonical product and ready fulfillment gates decide whether checkout is open. Held offers expose no payment or fulfillment route.'
}
$proof | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $proofFile -Encoding UTF8
Write-Host "PASS: $($approvedRecords.Count) approved source records match the canonical product/fulfillment gate ($($proof.canonical_open_count) open, $($proof.held_count) held)." -ForegroundColor Green
