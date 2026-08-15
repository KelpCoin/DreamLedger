#requires -Version 5.1
[CmdletBinding()]
param(
    [string]$BaseUrl = 'https://dreamledger.org',
    [string]$ProductId = 'BEC-PRIME-ARCHITECTURE-AUDIT-001',
    [string]$ProofPath = 'D:\BrownEyeCortex\BEC-PRIME\RUN-PROOFS\FIRST-ARCHITECTURE-AUDIT-CHECKOUT.json'
)

$ErrorActionPreference = 'Stop'
$BaseUrl = $BaseUrl.TrimEnd('/')
$started = Get-Date
$result = [ordered]@{
    launcher = 'BEC-PRIME Start-ArchitectureAuditSale v1'
    started_at_utc = $started.ToUniversalTime().ToString('o')
    base_url = $BaseUrl
    product_id = $ProductId
    status = 'BLOCKED'
    checkout_url = $null
    session_id = $null
    amount_minor = $null
    currency = $null
    blocker = $null
    elapsed_seconds = 0
}

try {
    $product = Invoke-RestMethod -Uri "$BaseUrl/api/products/$ProductId" -Method Get -Headers @{ 'Cache-Control' = 'no-cache' }
    if ($product.id -ne $ProductId) { throw 'Product not found' }
    if ($product.status -ne 'published') { throw 'Product is not published' }
    if ($product.approval_required -ne $false) { throw 'Product approval gate is still on' }
    if ([int]$product.inventory -lt 1) { throw 'Product inventory unavailable' }
    if ([int]$product.price -ne 2900) { throw "Price mismatch: expected NZD 29.00, got minor units $($product.price)" }
    if ([string]$product.currency -ne 'nzd') { throw "Currency mismatch: expected NZD, got $($product.currency)" }
    if ($product.checkout.mode -ne 'payment') { throw 'Checkout mode is not payment' }
    if ($product.commercial_truth.payment_surface -ne 'engine-generated-stripe-checkout') { throw 'Unexpected payment surface' }

    $body = @{ offer_id = $ProductId; region = 'NZ' } | ConvertTo-Json
    $checkout = Invoke-RestMethod -Uri "$BaseUrl/api/offer-checkout/create" -Method Post -ContentType 'application/json' -Body $body
    $checkoutUrl = $checkout.checkout_url
    if (-not $checkoutUrl) { $checkoutUrl = $checkout.url }
    if (-not $checkoutUrl) { throw 'Stripe did not return a checkout URL' }

    $result.status = 'CHECKOUT_CREATED_PAYMENT_UNPROVEN'
    $result.checkout_url = $checkoutUrl
    $result.session_id = $checkout.session_id
    $result.amount_minor = $checkout.amount_minor
    $result.currency = $checkout.currency
} catch {
    $result.status = 'BLOCKED'
    $result.blocker = $_.ErrorDetails.Message
    if (-not $result.blocker) { $result.blocker = $_.Exception.Message }
} finally {
    $result.elapsed_seconds = [math]::Round(((Get-Date) - $started).TotalSeconds, 3)
    $parent = Split-Path -Parent $ProofPath
    if ($parent -and -not (Test-Path -LiteralPath $parent)) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }
    $result | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $ProofPath -Encoding ASCII
}

Write-Host "STATUS: $($result.status)"
Write-Host "PRODUCT: $ProductId"
if ($result.amount_minor) { Write-Host "AMOUNT MINOR: $($result.amount_minor)" }
if ($result.checkout_url) { Write-Host "CHECKOUT URL: $($result.checkout_url)" }
if ($result.session_id) { Write-Host "STRIPE SESSION: $($result.session_id)" }
if ($result.blocker) { Write-Host "BLOCKER: $($result.blocker)" }
Write-Host "PROOF: $ProofPath"

if ($result.status -eq 'CHECKOUT_CREATED_PAYMENT_UNPROVEN') {
    Write-Host 'NEXT: a real buyer must complete checkout. A generated session is not a sale.'
    exit 0
}
exit 1
