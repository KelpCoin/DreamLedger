#requires -Version 5.1
[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$root = Join-Path $PSScriptRoot '..'
$offersFile = Join-Path $root 'catalog\offers\offers.json'
$approvedFile = Join-Path $root 'catalog\offers\approved.json'
$capabilitiesFile = Join-Path $root 'catalog\ip-capabilities.json'
$proofFile = Join-Path $root 'PROOF-OFFER-COMPILATION.json'

foreach ($file in @($offersFile, $approvedFile, $capabilitiesFile)) {
    if (-not (Test-Path -LiteralPath $file)) { throw "Missing required file: $file" }
}

$offers = Get-Content -Raw -LiteralPath $offersFile | ConvertFrom-Json
$approvedCatalog = Get-Content -Raw -LiteralPath $approvedFile | ConvertFrom-Json
$catalog = Get-Content -Raw -LiteralPath $capabilitiesFile | ConvertFrom-Json

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
    # A historical approval record is not a provider-backed authorization to sell.
    # This source-only compiler has no trusted live payment/fulfillment receipt.
    if ($offer.status -ne 'HELD_UNVERIFIED') {
        $errors.Add("${id}: source-only compiler must keep offer HELD_UNVERIFIED")
    }
    if ($offer.approval_required -ne $true) { $errors.Add("${id}: unverified offer must retain approval_required=true") }
    if ($offer.checkout_available -ne $false) { $errors.Add("${id}: unverified offer must keep checkout_available=false") }
    if (@($offer.readiness_blockers) -notcontains 'TRUSTED_PROVIDER_RECEIPT_REQUIRED') {
        $errors.Add("${id}: missing explicit trusted-provider-receipt blocker")
    }
    if ($offer.silo -ne $record.silo) { $errors.Add("${id}: silo mismatch between approved source and compiled catalog") }
    if ([double]$offer.price -ne [double]$record.price) { $errors.Add("${id}: price mismatch between approved source and compiled catalog") }
    if ([string]$offer.currency -ne [string]$record.currency) { $errors.Add("${id}: currency mismatch between approved source and compiled catalog") }
    if ($offer.capability_id -notin $validIds) { $errors.Add("${id}: compiled capability is not present in capability catalog") }
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
    release_status = 'HOLD'
    provider_receipt_verified = $false
    checkoutable_count = 0
    contract = 'historical approvals must compile as held until independent provider receipt and release approval'
}
$proof | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $proofFile -Encoding UTF8
Write-Host "PASS: $($approvedRecords.Count) historical approvals compiled HELD; checkout disabled, provider receipt missing." -ForegroundColor Green
