$ErrorActionPreference = 'Stop'
$root = Join-Path $PSScriptRoot '..'
$offersFile = Join-Path $root 'catalog\offers\offers.json'
if (-not (Test-Path $offersFile)) { throw "Missing compiled offers: $offersFile" }
$offers = Get-Content -Raw $offersFile | ConvertFrom-Json
$errors = 0
foreach ($offer in @($offers.offers)) {
    foreach ($field in @('offer_id','capability_id','name','problem','input','output','delivery_mechanism','deliverable','target_buyer','eligibility','constraints','price','currency','refund_rules','payment_adapter','checkout_route','approval_required','checkout_available','status','proof_of_delivery','verification_rules','provenance')) {
        if ($null -eq $offer.$field -or "$($offer.$field)" -eq '') { Write-Host "FAIL $($offer.offer_id): missing $field" -ForegroundColor Red; $errors++ }
    }
    if ([double]$offer.price -le 0) { Write-Host "FAIL $($offer.offer_id): price <= 0" -ForegroundColor Red; $errors++ }
    if ($offer.approval_required -ne $true) { Write-Host "FAIL $($offer.offer_id): approval gate not locked" -ForegroundColor Red; $errors++ }
    if ($offer.checkout_available -ne $false) { Write-Host "FAIL $($offer.offer_id): checkout enabled" -ForegroundColor Red; $errors++ }
    if ($offer.status -ne 'candidate') { Write-Host "FAIL $($offer.offer_id): status not candidate" -ForegroundColor Red; $errors++ }
    if ($offer.provenance.private_material -ne 'excluded') { Write-Host "FAIL $($offer.offer_id): private material not excluded" -ForegroundColor Red; $errors++ }
}
$ids = @($offers.offers | ForEach-Object { $_.offer_id })
foreach ($dup in ($ids | Group-Object | Where-Object Count -gt 1)) { Write-Host "FAIL duplicate offer id: $($dup.Name)" -ForegroundColor Red; $errors++ }
if ($errors -gt 0) { exit 1 }
Write-Host "PASS: $($offers.offers.Count) offers passed the offer Gauntlet." -ForegroundColor Green
