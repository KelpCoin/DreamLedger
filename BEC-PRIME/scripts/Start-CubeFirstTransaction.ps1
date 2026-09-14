#requires -Version 5.1
[CmdletBinding()]
param(
    [string]$BaseUrl = 'https://dreamledger.org',
    [string]$ProductId = 'EDH_0001',
    [switch]$CreateCheckout,
    [string]$ProofPath = 'D:\BrownEyeCortex\BEC-PRIME\RUN-PROOFS\CUBE-FIRST-TRANSACTION.json'
)

$ErrorActionPreference = 'Stop'
$BaseUrl = $BaseUrl.TrimEnd('/')
$started = Get-Date
$result = [ordered]@{
    schema = 'CUBE-FIRST-TRANSACTION/v1'
    started_at_utc = $started.ToUniversalTime().ToString('o')
    base_url = $BaseUrl
    product_id = $ProductId
    product = $null
    marketplace_catalog = $null
    marketplace_listing = $null
    checkout = $null
    status = 'BLOCKED'
    payment_truth = 'UNPROVEN'
    blocker = $null
    next_action = $null
    elapsed_seconds = 0
}

function Get-Json($Uri) {
    Invoke-RestMethod -Uri $Uri -Method Get -Headers @{ 'Cache-Control' = 'no-cache' }
}

try {
    Write-Host '[1/5] Reading canonical product...'
    $product = Get-Json "$BaseUrl/api/products/$ProductId"
    $result.product = [ordered]@{
        id = $product.id
        title = $product.name
        price = $product.price
        currency = $product.currency
        inventory = $product.inventory
        status = $product.status
        approval_required = $product.approval_required
    }
    if ($product.id -ne $ProductId) { throw 'Canonical product not found' }
    if ($product.status -ne 'published') { throw 'Canonical product is not published' }
    if ([int]$product.inventory -lt 1) { throw 'Canonical product has no inventory' }
    if ($product.approval_required -ne $false) { throw 'Canonical product approval gate is still on' }

    Write-Host '[2/5] Reading CUBE marketplace catalog...'
    $catalog = Get-Json "$BaseUrl/api/marketplace/catalog"
    $catalogMatches = @($catalog.items | Where-Object {
        $_.sku_id -eq $ProductId -or $_.item_id -eq $ProductId -or $_.id -eq $ProductId
    })
    $result.marketplace_catalog = [ordered]@{
        item_count = @($catalog.items).Count
        matching_items = $catalogMatches.Count
    }

    Write-Host '[3/5] Reading marketplace listings...'
    $listings = Get-Json "$BaseUrl/api/marketplace/listings?q=$([uri]::EscapeDataString($ProductId))"
    $match = @($listings.items | Where-Object {
        $_.id -eq $ProductId -or $_.title -match [regex]::Escape($ProductId)
    }) | Select-Object -First 1
    if (-not $match -and $catalogMatches.Count -eq 1) {
        $catalogItem = $catalogMatches[0]
        $byTitle = @($listings.items | Where-Object {
            $_.title -eq $catalogItem.title
        }) | Select-Object -First 1
        if ($byTitle) { $match = $byTitle }
    }
    if ($match) {
        $result.marketplace_listing = [ordered]@{
            id = $match.id
            title = $match.title
            seller_id = $match.seller_id
            price = $match.price
            currency = $match.currency
            status = $match.status
            checkout_available = $match.checkout_available
        }
    }

    if (-not $CreateCheckout) {
        if (-not $match) {
            $result.status = 'LISTING_REQUIRED'
            $result.next_action = 'Create or approve the first CUBE listing for the canonical product, then rerun with -CreateCheckout.'
        } elseif ($match.checkout_available -ne $true) {
            $result.status = 'CHECKOUT_BLOCKED'
            $result.next_action = 'Make the matched CUBE listing checkoutable, then rerun with -CreateCheckout.'
        } else {
            $result.status = 'READY_FOR_REAL_BUYER'
            $result.next_action = 'Send the listing to an independent buyer. Do not self-pay. Settled Stripe payment is the only revenue truth.'
        }
    } else {
        if (-not $match) { throw 'No CUBE listing matched ProductId' }
        if ($match.checkout_available -ne $true) { throw 'CUBE listing is not checkoutable' }

        Write-Host '[4/5] Creating Stripe Checkout Session for the matched CUBE listing...'
        $checkout = Invoke-RestMethod -Uri "$BaseUrl/api/marketplace/listings/$([uri]::EscapeDataString($match.id))/checkout" -Method Post -ContentType 'application/json' -Body '{}'
        $result.checkout = [ordered]@{
            session_id = $checkout.session_id
            checkout_url = $checkout.checkout_url
        }
        if (-not $checkout.checkout_url) { throw 'Checkout endpoint returned no checkout_url' }
        $result.status = 'CHECKOUT_CREATED_PAYMENT_UNPROVEN'
        $result.payment_truth = 'UNPROVEN'
        $result.next_action = 'Independent buyer must complete this Checkout Session. Checkout creation is not revenue.'
    }

    if ($result.status -eq 'READY_FOR_REAL_BUYER') {
        Write-Host '[4/5] Checkout path is ready.'
    }
    Write-Host '[5/5] No payment is claimed by this verifier.'
} catch {
    $result.status = 'BLOCKED'
    $result.blocker = $_.Exception.Message
    $result.next_action = 'Fix the reported blocker and rerun this script.'
} finally {
    $result.elapsed_seconds = [math]::Round(((Get-Date) - $started).TotalSeconds, 3)
    $parent = Split-Path -Parent $ProofPath
    if ($parent -and -not (Test-Path -LiteralPath $parent)) {
        New-Item -ItemType Directory -Path $parent -Force | Out-Null
    }
    $result | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $ProofPath -Encoding ASCII
}

Write-Host "STATUS: $($result.status)"
Write-Host "PRODUCT: $ProductId"
if ($result.marketplace_listing) { Write-Host "LISTING: $($result.marketplace_listing.id)" }
if ($result.checkout) { Write-Host "CHECKOUT URL: $($result.checkout.checkout_url)" }
if ($result.blocker) { Write-Host "BLOCKER: $($result.blocker)" }
Write-Host "PROOF: $ProofPath"

if ($result.status -eq 'BLOCKED' -or $result.status -eq 'LISTING_REQUIRED' -or $result.status -eq 'CHECKOUT_BLOCKED') { exit 1 }
exit 0
