$ErrorActionPreference = 'Stop'
$root = Join-Path $PSScriptRoot '..'
$offersFile = Join-Path $root 'catalog\offers\offers.json'
$candidatesFile = Join-Path $root 'catalog\offers\candidates.json'
$approvedFile = Join-Path $root 'catalog\offers\approved.json'
$capabilitiesFile = Join-Path $root 'catalog\ip-capabilities.json'
$proofFile = Join-Path $root 'PROOF-OFFER-COMPILATION.json'
foreach ($file in @($offersFile, $candidatesFile, $approvedFile, $capabilitiesFile)) { if (-not (Test-Path $file)) { throw "Missing required file: $file" } }
$offers = Get-Content -Raw $offersFile | ConvertFrom-Json
$candidates = Get-Content -Raw $candidatesFile | ConvertFrom-Json
$approvedCatalog = Get-Content -Raw $approvedFile | ConvertFrom-Json
$catalog = Get-Content -Raw $capabilitiesFile | ConvertFrom-Json
$validIds = @($catalog.capabilities | ForEach-Object { $_.id })
$approvedIds = @($approvedCatalog.approved | ForEach-Object { $_.offer_id })
$canonicalProductOffer = 'OFFER-CMD-DIAG-29-NZD'
$errors = New-Object System.Collections.Generic.List[string]
if ($offers.schema -ne 'BEC-PRIME/OFFER-CATALOG/v1') { $errors.Add('offers schema mismatch') }
if ($offers.compiler -ne 'offer-compiler-v1') { $errors.Add('compiler version mismatch') }
if ($offers.source -ne 'catalog/ip-capabilities.json') { $errors.Add('source mismatch') }
$ids = @()
$generatedCount = 0
$approvedCount = 0
foreach ($offer in @($offers.offers)) {
    foreach ($field in @('offer_id','capability_id','name','problem','input','output','delivery_mechanism','deliverable','target_buyer','eligibility','constraints','price','currency','refund_rules','payment_adapter','checkout_route','approval_required','checkout_available','status','proof_of_delivery','verification_rules','provenance')) {
        if ($null -eq $offer.$field -or "$($offer.$field)" -eq '') { $errors.Add("$($offer.offer_id): missing $field") }
    }
    if ($offer.capability_id -notin $validIds) { $errors.Add("$($offer.offer_id): unknown capability") }
    if ([double]$offer.price -le 0) { $errors.Add("$($offer.offer_id): non-positive price") }
    if ($offer.currency -ne 'NZD') { $errors.Add("$($offer.offer_id): unexpected currency") }
    $isExplicitlyApproved = $offer.offer_id -in $approvedIds
    if ($isExplicitlyApproved) {
        $approvedCount++
        if ($offer.approval_required -ne $false) { $errors.Add("$($offer.offer_id): approved offer must have approval_required=false") }
        if ($offer.checkout_available -ne $true) { $errors.Add("$($offer.offer_id): explicitly approved offer must have checkout enabled") }
        if ($offer.status -ne 'VERIFIED_AVAILABLE') { $errors.Add("$($offer.offer_id): approved offer status is not VERIFIED_AVAILABLE") }
    } else {
        $generatedCount++
        if ($offer.approval_required -ne $true) { $errors.Add("$($offer.offer_id): approval gate is not locked") }
        if ($offer.checkout_available -ne $false) { $errors.Add("$($offer.offer_id): checkout is enabled") }
        if ($offer.status -ne 'candidate') { $errors.Add("$($offer.offer_id): status is not candidate") }
    }
    if ($offer.provenance.private_material -ne 'excluded') { $errors.Add("$($offer.offer_id): private material is not excluded") }
    $ids += $offer.offer_id
}
foreach ($approvedId in $approvedIds) {
    if ($approvedId -eq $canonicalProductOffer) { continue }
    if ($approvedId -notin $ids) { $errors.Add("approved offer missing from compiled catalog: $approvedId") }
}
foreach ($dup in ($ids | Group-Object | Where-Object Count -gt 1)) { $errors.Add("duplicate offer id: $($dup.Name)") }
$cmd = @($approvedCatalog.approved | Where-Object { $_.offer_id -eq $canonicalProductOffer }) | Select-Object -First 1
if (-not $cmd) { $errors.Add('canonical Commander Diagnostic offer missing') }
elseif ([double]$cmd.price -ne 29 -or $cmd.product_id -ne 'COMMANDER-DECK-DIAGNOSTIC-001' -or $cmd.product_sku -ne 'CMD-DIAG-29') { $errors.Add('canonical Commander Diagnostic identity/price mismatch') }
if ($errors.Count -gt 0) {
    $proof = [ordered]@{ type='dreamledger-offer-compilation-proof'; status='FAIL'; verified_at=(Get-Date).ToUniversalTime().ToString('o'); errors=$errors; generated_offers=$generatedCount; explicitly_approved_offers=$approvedCount }
    $proof | ConvertTo-Json -Depth 10 | Set-Content -Encoding utf8 $proofFile
    $errors | ForEach-Object { Write-Host "FAIL: $_" -ForegroundColor Red }
    exit 1
}
$proof = [ordered]@{ type='dreamledger-offer-compilation-proof'; status='PASS'; verified_at=(Get-Date).ToUniversalTime().ToString('o'); compiler=$offers.compiler; capabilities=[int]$offers.counts.capabilities; candidates=[int]$offers.counts.candidates; compiled=[int]$offers.counts.passed; approved=[int]$offers.counts.approved; rejected=[int]$offers.counts.rejected; generated_offers=$generatedCount; explicitly_approved_offers=$approvedCount; canonical_product_offer=$canonicalProductOffer; generated_offers_require_approval=$true; generated_offers_checkout_disabled=$true; approved_offers_require_explicit_record=$true; approved_offers_checkout_enabled=$true; source=$offers.source; offer_ids=$ids }
$proof | ConvertTo-Json -Depth 10 | Set-Content -Encoding utf8 $proofFile
Write-Host "PASS: $($ids.Count) compiled offers verified ($generatedCount gated candidates, $approvedCount explicitly approved)." -ForegroundColor Green
Write-Host "Proof: $proofFile" -ForegroundColor Green
