$ErrorActionPreference = 'Stop'
$root = Join-Path $PSScriptRoot '..'
$offersFile = Join-Path $root 'catalog\offers\offers.json'
$approvedFile = Join-Path $root 'catalog\offers\approved.json'
if (-not (Test-Path $offersFile)) { throw "Missing compiled offers: $offersFile" }
if (-not (Test-Path $approvedFile)) { throw "Missing approved source catalogue: $approvedFile" }

$offers = Get-Content -Raw $offersFile | ConvertFrom-Json
$approvedCatalog = Get-Content -Raw $approvedFile | ConvertFrom-Json
$approvedRecords = @($approvedCatalog.approved)
$approvedById = @{}
foreach ($record in $approvedRecords) {
    $id = [string]$record.offer_id
    if ([string]::IsNullOrWhiteSpace($id)) { throw 'Approved source contains a record with no offer_id' }
    if ($approvedById.ContainsKey($id)) { throw "Duplicate approved source offer_id: $id" }
    $approvedById[$id] = $record
}

$errors = 0
$requiredFields = @('offer_id','capability_id','name','problem','input','output','delivery_mechanism','deliverable','target_buyer','eligibility','constraints','price','currency','refund_rules','payment_adapter','checkout_route','fulfillment_route','approval_required','checkout_available','status','proof_of_delivery','verification_rules','provenance')

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

    $isApproved = $approvedById.ContainsKey([string]$offer.offer_id)
    if ($isApproved) {
        $record = $approvedById[[string]$offer.offer_id]
        $checkoutAuthorized = ($record.checkout_authorized -eq $true) -and ($record.evidence_status -eq 'VERIFIED') -and ($record.fulfillment_status -eq 'VERIFIED_AUTOMATED') -and ($record.payment_link_status -eq 'ACTIVE_LIVEMODE') -and (-not [string]::IsNullOrWhiteSpace([string]$record.payment_link_url))

        if ($checkoutAuthorized) {
            if ($offer.approval_required -ne $false) {
                Write-Host "FAIL $($offer.offer_id): authorized offer must have approval_required=false" -ForegroundColor Red
                $errors++
            }
            if ($offer.checkout_available -ne $true) {
                Write-Host "FAIL $($offer.offer_id): authorized offer checkout is not enabled" -ForegroundColor Red
                $errors++
            }
            if ($offer.status -ne 'VERIFIED_AVAILABLE') {
                Write-Host "FAIL $($offer.offer_id): authorized offer status is not VERIFIED_AVAILABLE" -ForegroundColor Red
                $errors++
            }
            if ([string]$offer.payment_link_url -ne [string]$record.payment_link_url) {
                Write-Host "FAIL $($offer.offer_id): live payment link does not match the canonical approved record" -ForegroundColor Red
                $errors++
            }
        } else {
            # Approved is a registry classification, not permission to collect money.
            # Incomplete evidence or fulfillment must compile into a deliberately held offer.
            if ($offer.approval_required -ne $true) {
                Write-Host "FAIL $($offer.offer_id): held offer must keep approval_required=true" -ForegroundColor Red
                $errors++
            }
            if ($offer.checkout_available -ne $false) {
                Write-Host "FAIL $($offer.offer_id): held offer has checkout_available=true" -ForegroundColor Red
                $errors++
            }
            if ($offer.status -ne 'HELD') {
                Write-Host "FAIL $($offer.offer_id): unverified approved offer must have status HELD" -ForegroundColor Red
                $errors++
            }
            if ($null -ne $offer.payment_link_url -and -not [string]::IsNullOrWhiteSpace([string]$offer.payment_link_url)) {
                Write-Host "FAIL $($offer.offer_id): held offer exposes payment_link_url" -ForegroundColor Red
                $errors++
            }
            if ($offer.checkout_route -ne 'held_pending_evidence') {
                Write-Host "FAIL $($offer.offer_id): held offer checkout route must be held_pending_evidence" -ForegroundColor Red
                $errors++
            }
            if ($offer.fulfillment_route -ne 'held_pending_evidence') {
                Write-Host "FAIL $($offer.offer_id): held offer fulfillment route must be held_pending_evidence" -ForegroundColor Red
                $errors++
            }
        }
    } else {
        if ($offer.approval_required -ne $true) {
            Write-Host "FAIL $($offer.offer_id): candidate approval gate not locked" -ForegroundColor Red
            $errors++
        }
        if ($offer.checkout_available -ne $false) {
            Write-Host "FAIL $($offer.offer_id): candidate checkout enabled" -ForegroundColor Red
            $errors++
        }
        if ($offer.status -ne 'candidate') {
            Write-Host "FAIL $($offer.offer_id): unapproved generated offer status must be candidate" -ForegroundColor Red
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
$authorizedCount = @($offers.offers | Where-Object { $_.checkout_available -eq $true }).Count
$heldCount = @($offers.offers | Where-Object { $_.status -eq 'HELD' }).Count
$candidateCount = @($offers.offers | Where-Object { $_.status -eq 'candidate' }).Count
Write-Host "PASS: $($offers.offers.Count) offers passed offer Gauntlet; checkoutable=$authorizedCount, held=$heldCount, candidate=$candidateCount." -ForegroundColor Green
