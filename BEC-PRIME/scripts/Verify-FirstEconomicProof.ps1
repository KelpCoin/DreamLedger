#!/usr/bin/env pwsh
# BEC-PRIME first economic proof verifier.
# Fail closed. A human supplied PaymentIntent ID is never accepted as evidence.
# The Checkout Session and PaymentIntent are independently retrieved from Stripe.

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$CheckoutSessionId,
    [string]$PaymentLinkId = "plink_1U7F9QEGgEAnUFF9NjRq8gNq",
    [int]$ExpectedAmountMinor = 4900,
    [string]$ExpectedCurrency = "nzd",
    [string]$ExpectedOfferId = "OFFER-BEC-PRIME-ARCHITECTURE-AUDIT",
    [string]$SupabaseUrl = $env:SUPABASE_URL,
    [string]$SupabaseServiceKey = $env:SUPABASE_SERVICE_ROLE_KEY,
    [string]$ProofRoot = "D:\BrownEyeCortex\BEC-PRIME\RUN-PROOFS\ECONOMIC"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Fail-Closed([string]$Message) {
    Write-Host "FAIL-CLOSED: $Message" -ForegroundColor Red
    exit 1
}

if ([string]::IsNullOrWhiteSpace($env:STRIPE_SECRET_KEY)) { Fail-Closed "STRIPE_SECRET_KEY is missing." }
if ([string]::IsNullOrWhiteSpace($SupabaseUrl)) { Fail-Closed "SUPABASE_URL is missing." }
if ([string]::IsNullOrWhiteSpace($SupabaseServiceKey)) { Fail-Closed "SUPABASE_SERVICE_ROLE_KEY is missing." }
if ($CheckoutSessionId -notmatch '^cs_[A-Za-z0-9_]+$') { Fail-Closed "CheckoutSessionId is not a valid Stripe Checkout Session identifier." }

New-Item -ItemType Directory -Force -Path $ProofRoot | Out-Null

function Invoke-StripeGet([string]$Path) {
    $auth = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes(($env:STRIPE_SECRET_KEY + ":")))
    Invoke-RestMethod -Method Get -Uri ("https://api.stripe.com/v1/" + $Path) -Headers @{ Authorization = "Basic $auth" } -TimeoutSec 20
}

function Invoke-SupabaseGet([string]$Path) {
    Invoke-RestMethod -Method Get -Uri ($SupabaseUrl.TrimEnd('/') + "/rest/v1/" + $Path) -Headers @{
        apikey = $SupabaseServiceKey
        Authorization = "Bearer $SupabaseServiceKey"
    } -TimeoutSec 20
}

Write-Host "=== BEC-PRIME FIRST ECONOMIC PROOF ===" -ForegroundColor Cyan
Write-Host "Session: $CheckoutSessionId"

$session = Invoke-StripeGet ("checkout/sessions/" + [Uri]::EscapeDataString($CheckoutSessionId))

if (-not $session) { Fail-Closed "Stripe returned no Checkout Session." }
if ($session.payment_link -ne $PaymentLinkId) { Fail-Closed "Checkout Session is not attached to the canonical BEC-PRIME Payment Link." }
if ($session.payment_status -ne "paid") {
    Write-Host "NO_SALE: payment_status=$($session.payment_status)" -ForegroundColor Yellow
    exit 0
}
if ([int64]$session.amount_total -ne $ExpectedAmountMinor) { Fail-Closed "Checkout amount mismatch." }
if ([string]$session.currency -ne $ExpectedCurrency) { Fail-Closed "Checkout currency mismatch." }

$paymentIntentId = [string]$session.payment_intent
if ([string]::IsNullOrWhiteSpace($paymentIntentId)) { Fail-Closed "Paid Checkout Session has no PaymentIntent." }

Write-Host "Provider event observed: paid Checkout Session."
Write-Host "Independently retrieving PaymentIntent: $paymentIntentId"

$pi = Invoke-StripeGet ("payment_intents/" + [Uri]::EscapeDataString($paymentIntentId))
if (-not $pi) { Fail-Closed "Stripe returned no PaymentIntent." }
if ($pi.status -ne "succeeded") { Fail-Closed "PaymentIntent status is '$($pi.status)', not succeeded." }
if ([int64]$pi.amount -ne $ExpectedAmountMinor) { Fail-Closed "PaymentIntent amount mismatch." }
if ([string]$pi.currency -ne $ExpectedCurrency) { Fail-Closed "PaymentIntent currency mismatch." }

# Independently retrieve the Payment Link line item so the commercial object is provider-derived.
$lineItems = Invoke-StripeGet ("payment_links/" + [Uri]::EscapeDataString($PaymentLinkId) + "/line_items?limit=10")
$canonicalItem = $lineItems.data | Where-Object { $_.price.metadata.offer_id -eq $ExpectedOfferId } | Select-Object -First 1
if (-not $canonicalItem) { Fail-Closed "Canonical offer metadata was not found on the live Payment Link." }
if ([int64]$canonicalItem.amount_total -ne $ExpectedAmountMinor) { Fail-Closed "Payment Link line-item amount mismatch." }
if ([string]$canonicalItem.currency -ne $ExpectedCurrency) { Fail-Closed "Payment Link line-item currency mismatch." }

# Idempotency lookup. Existing evidence means no second settlement is written.
$encodedPi = [Uri]::EscapeDataString($paymentIntentId)
try {
    $existing = Invoke-SupabaseGet ("economic_events?select=id,event_type&payload->>stripe_payment_intent=eq.$encodedPi&limit=1")
} catch {
    Fail-Closed "Could not query economic_events idempotency state: $($_.Exception.Message)"
}
if ($existing -and @($existing).Count -gt 0) {
    Write-Host "IDEMPOTENT: Existing economic event found for PaymentIntent $paymentIntentId." -ForegroundColor Yellow
    exit 0
}

$proof = [ordered]@{
    event_type = "SALE_SETTLED"
    provider = "stripe"
    verification_status = "verified"
    verification_method = "independent_stripe_api_retrieval"
    checkout_session_id = $CheckoutSessionId
    payment_intent_id = $paymentIntentId
    payment_link_id = $PaymentLinkId
    offer_id = $ExpectedOfferId
    amount_minor = [int64]$pi.amount
    currency = [string]$pi.currency
    provider_payment_status = [string]$session.payment_status
    payment_intent_status = [string]$pi.status
    verified_at_utc = (Get-Date).ToUniversalTime().ToString("o")
}

$stamp = (Get-Date).ToUniversalTime().ToString("yyyyMMdd-HHmmssfff")
$proofPath = Join-Path $ProofRoot ("SALE_SETTLED_{0}_{1}.json" -f $stamp, $paymentIntentId)
$proofJson = $proof | ConvertTo-Json -Depth 10
[IO.File]::WriteAllText($proofPath, $proofJson + [Environment]::NewLine, [Text.UTF8Encoding]::new($false))
$hash = (Get-FileHash -Path $proofPath -Algorithm SHA256).Hash
[IO.File]::WriteAllText(($proofPath + ".sha256"), $hash + [Environment]::NewLine, [Text.UTF8Encoding]::new($false))

# Only after independent provider verification and local proof creation do we attempt settlement recording.
$settlement = @{
    silo_id = "BEC-PRIME"
    event_type = "SALE_SETTLED"
    sku_id = $ExpectedOfferId
    payload = @{
        stripe_payment_intent = $paymentIntentId
        checkout_session_id = $CheckoutSessionId
        payment_link_id = $PaymentLinkId
        amount_minor = [int64]$pi.amount
        currency = [string]$pi.currency
        verification_source = "independent_stripe_api_retrieval"
        verification_status = "verified"
        proof_path = $proofPath
        proof_hash = $hash
    }
} | ConvertTo-Json -Depth 10

try {
    Invoke-RestMethod -Method Post -Uri ($SupabaseUrl.TrimEnd('/') + "/rest/v1/economic_events") -Headers @{
        apikey = $SupabaseServiceKey
        Authorization = "Bearer $SupabaseServiceKey"
        "Content-Type" = "application/json"
        Prefer = "return=minimal"
    } -Body $settlement -TimeoutSec 20 | Out-Null
} catch {
    Fail-Closed "Proof was generated but SALE_SETTLED ledger write failed. DO NOT claim economic completion. $($_.Exception.Message)"
}

Write-Host "FIRST_ECONOMIC_EVENT_PROVEN = TRUE" -ForegroundColor Green
Write-Host "SALE_SETTLED = TRUE" -ForegroundColor Green
Write-Host "Proof: $proofPath"
Write-Host "SHA256: $hash"
Write-Host "Economic proof is now grounded in independently retrieved Stripe evidence." -ForegroundColor Green
