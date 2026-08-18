$ErrorActionPreference = 'Stop'
$root = Join-Path $PSScriptRoot '..'
$offersFile = Join-Path $root 'catalog\offers\offers.json'
$approvedFile = Join-Path $root 'catalog\offers\approved.json'
if (-not (Test-Path $offersFile)) { throw "Missing compiled offers: $offersFile" }
$offers = Get-Content -Raw $offersFile | ConvertFrom-Json
$approvedIds = @()
if (Test-Path $approvedFile) {
    $approvedCatalog = Get-Content -Raw $approvedFile | ConvertFrom-Json
    $approvedIds = @($approvedCatalog.approved | ForEach-Object { $_.offer_id })
}
$errors = 0
$requiredFields = @('offer_id','capability_id','name','problem','input','output','delivery_mechanism','deliverable','target_buyer','eligibility','constraints','price','currency','refund_rules','payment_adapter','checkout_route','approval_required','checkout_available','status','proof_of_delivery','verification_rules','provenance')

foreach ($offer in @($offers.offers)) {
    foreach ($field in $requiredFields) {
        if ($null -eq $offer.$field -or "$($offer.$field)" -eq '') {
            Write-Host "FAIL $($offer.offer_id): missing $field" -ForegroundColor Red
            $errors++
        }
    }

    if ([double]$offer.price -le 0) {
        Write-Host "FAIL $($offer.offer_id): price <= 0" -ForegroundColor Red
        $errors++
    }

    $isApproved = $approvedIds -contains $offer.offer_id
    if ($isApproved) {
        if ($offer.approval_required -ne $false) {
            Write-Host "FAIL $($offer.offer_id): approved offer must have approval_required=false" -ForegroundColor Red
            $errors++
        }
        if ($offer.checkout_available -ne $true) {
            Write-Host "FAIL $($offer.offer_id): approved offer must have checkout_available=true" -ForegroundColor Red
            $errors++
        }
        if ($offer.status -ne 'VERIFIED_AVAILABLE') {
            Write-Host "FAIL $($offer.offer_id): approved offer must have status VERIFIED_AVAILABLE" -ForegroundColor Red
            $errors++
        }
    } else {
        if ($offer.approval_required -ne $true) {
            Write-Host "FAIL $($offer.offer_id): generated offer approval gate not locked" -ForegroundColor Red
            $errors++
        }
        if ($offer.checkout_available -ne $false) {
            Write-Host "FAIL $($offer.offer_id): generated offer checkout enabled" -ForegroundColor Red
            $errors++
        }
        if ($offer.status -ne 'candidate') {
            Write-Host "FAIL $($offer.offer_id): generated offer status not candidate" -ForegroundColor Red
            $errors++
        }
    }

    if ($offer.provenance.private_material -ne 'excluded') {
        Write-Host "FAIL $($offer.offer_id): private material not excluded" -ForegroundColor Red
        $errors++
    }
}

$ids = @($offers.offers | ForEach-Object { $_.offer_id })
foreach ($dup in ($ids | Group-Object | Where-Object Count -gt 1)) {
    Write-Host "FAIL duplicate offer id: $($dup.Name)" -ForegroundColor Red
    $errors++
}

if ($errors -gt 0) { exit 1 }
Write-Host "PASS: $($offers.offers.Count) offers passed the offer Gauntlet." -ForegroundColor Green
