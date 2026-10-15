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
    if ($offer.approval_required -ne $false) { $errors.Add("${id}: approval_required must be false") }
    if ($offer.checkout_available -ne $true) { $errors.Add("${id}: checkout_available must be true") }
    if ($offer.status -ne 'VERIFIED_AVAILABLE') { $errors.Add("${id}: status must be VERIFIED_AVAILABLE") }
    if ($offer.silo -ne $record.silo) { $errors.Add("${id}: silo mismatch between approved source and compiled catalog") }
    if ([double]$offer.price -ne [double]$record.price) { $errors.Add("${id}: price mismatch between approved source and compiled catalog") }
    if ([string]$offer.currency -ne [string]$record.currency) { $errors.Add("${id}: currency mismatch between approved source and compiled catalog") }
    if ($offer.capability_id -notin $validIds) { $errors.Add("${id}: compiled capability is not present in capability catalog") }
}

# Zero approved offers is valid while all commerce rails are held.
$heldRecords = @($approvedCatalog.held)
$approvedIds = @($approvedRecords | ForEach-Object { [string]$_.offer_id })
foreach ($held in $heldRecords) {
    $id = [string]$held.offer_id
    if ([string]::IsNullOrWhiteSpace($id)) { $errors.Add('held record missing offer_id'); continue }
    if ($id -in $approvedIds) { $errors.Add("held offer must not also be approved: $id") }
    if ($held.status -ne 'HELD') { $errors.Add("$id: held record status must be HELD") }
    if ($null -ne $held.payment_link_url) { $errors.Add("$id: held record exposes payment_link_url") }
    if ($held.payment_link_status -ne 'HELD_NOT_PROMOTED') { $errors.Add("$id: held record must not be promoted") }
}

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
    contract = 'only explicitly approved records may be VERIFIED_AVAILABLE; held records have no payment URL; zero approved offers is valid'
}
$proof | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $proofFile -Encoding UTF8
Write-Host "PASS: $($approvedRecords.Count) approved offer records are consistent; $($heldRecords.Count) held records expose no payment URLs." -ForegroundColor Green
