$ErrorActionPreference = 'Stop'
$root = Join-Path $PSScriptRoot '..'
$offersFile = Join-Path $root 'catalog\offers\offers.json'
$candidatesFile = Join-Path $root 'catalog\offers\candidates.json'
$capabilitiesFile = Join-Path $root 'catalog\ip-capabilities.json'
$proofFile = Join-Path $root 'PROOF-OFFER-COMPILATION.json'
foreach ($file in @($offersFile, $candidatesFile, $capabilitiesFile)) { if (-not (Test-Path $file)) { throw "Missing required file: $file" } }
$offers = Get-Content -Raw $offersFile | ConvertFrom-Json
$candidates = Get-Content -Raw $candidatesFile | ConvertFrom-Json
$catalog = Get-Content -Raw $capabilitiesFile | ConvertFrom-Json
$validIds = @($catalog.capabilities | ForEach-Object { $_.id })
$errors = New-Object System.Collections.Generic.List[string]
if ($offers.schema -ne 'BEC-PRIME/OFFER-CATALOG/v1') { $errors.Add('offers schema mismatch') }
if ($offers.compiler -ne 'offer-compiler-v1') { $errors.Add('compiler version mismatch') }
if ($offers.source -ne 'catalog/ip-capabilities.json') { $errors.Add('source mismatch') }
$ids = @()
foreach ($offer in @($offers.offers)) {
    foreach ($field in @('offer_id','capability_id','name','problem','input','output','delivery_mechanism','deliverable','target_buyer','eligibility','constraints','price','currency','refund_rules','payment_adapter','checkout_route','approval_required','checkout_available','status','proof_of_delivery','verification_rules','provenance')) {
        if ($null -eq $offer.$field -or "$($offer.$field)" -eq '') { $errors.Add("$($offer.offer_id): missing $field") }
    }
    if ($offer.capability_id -notin $validIds) { $errors.Add("$($offer.offer_id): unknown capability") }
    if ([double]$offer.price -le 0) { $errors.Add("$($offer.offer_id): non-positive price") }
    if ($offer.currency -ne 'NZD') { $errors.Add("$($offer.offer_id): unexpected currency") }
    if ($offer.approval_required -ne $true) { $errors.Add("$($offer.offer_id): approval gate is not locked") }
    if ($offer.checkout_available -ne $false) { $errors.Add("$($offer.offer_id): checkout is enabled") }
    if ($offer.status -ne 'candidate') { $errors.Add("$($offer.offer_id): status is not candidate") }
    if ($offer.provenance.private_material -ne 'excluded') { $errors.Add("$($offer.offer_id): private material is not excluded") }
    $ids += $offer.offer_id
}
foreach ($dup in ($ids | Group-Object | Where-Object Count -gt 1)) { $errors.Add("duplicate offer id: $($dup.Name)") }
if ($errors.Count -gt 0) {
    $proof = [ordered]@{ type='dreamledger-offer-compilation-proof'; status='FAIL'; verified_at=(Get-Date).ToUniversalTime().ToString('o'); errors=$errors }
    $proof | ConvertTo-Json -Depth 10 | Set-Content -Encoding utf8 $proofFile
    $errors | ForEach-Object { Write-Host "FAIL: $_" -ForegroundColor Red }
    exit 1
}
$proof = [ordered]@{
    type='dreamledger-offer-compilation-proof'
    status='PASS'
    verified_at=(Get-Date).ToUniversalTime().ToString('o')
    compiler=$offers.compiler
    capabilities=[int]$offers.counts.capabilities
    candidates=[int]$offers.counts.candidates
    compiled=[int]$offers.counts.passed
    rejected=[int]$offers.counts.rejected
    approval_required_for_all=$true
    checkout_available_for_all=$false
    source=$offers.source
    offer_ids=$ids
}
$proof | ConvertTo-Json -Depth 10 | Set-Content -Encoding utf8 $proofFile
Write-Host "PASS: $($ids.Count) compiled offers verified." -ForegroundColor Green
Write-Host "Proof: $proofFile" -ForegroundColor Green
