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
        $heldIsSafe = (
            $offer.approval_required -eq $true -and
            $offer.checkout_available -eq $false -and
            ([string]$offer.status).StartsWith('HELD_') -and
            [string]::IsNullOrWhiteSpace([string]$offer.payment_link_url) -and
            [string]::IsNullOrWhiteSpace([string]$offer.fulfillment_route) -and
            -not [string]::IsNullOrWhiteSpace([string]$offer.checkout_disabled_reason)
        )
        $openIsSafe = (
            $offer.approval_required -eq $false -and
            $offer.checkout_available -eq $true -and
            $offer.status -eq 'VERIFIED_AVAILABLE' -and
            ([string]$offer.payment_link_url) -match '^https://(buy|checkout)\.stripe\.com/' -and
            -not [string]::IsNullOrWhiteSpace([string]$offer.fulfillment_route)
        )
        if (-not ($heldIsSafe -or $openIsSafe)) {
            Write-Host "FAIL $($offer.offer_id): approved source must compile to either a fully gated VERIFIED_AVAILABLE offer or a clean HELD offer with no public payment/fulfillment route" -ForegroundColor Red
            $errors++
        } elseif ($heldIsSafe) {
            Write-Host "HOLD $($offer.offer_id): canonical product/fulfillment evidence is incomplete; checkout remains disabled." -ForegroundColor Yellow
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
