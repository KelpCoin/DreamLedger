#requires -Version 5.1
[CmdletBinding()]
param(
    [ValidateSet('Create','Verify')]
    [string]$Action = 'Create',
    [string]$CheckoutSessionId,
    [string]$BaseUrl = 'https://dreamledger.org',
    [string]$OfferId = 'OFFER-BEC-PRIME-ARCHITECTURE-AUDIT',
    [int]$ExpectedAmountMinor = 4900,
    [string]$ExpectedCurrency = 'nzd',
    [string]$ProofRoot = 'D:\BrownEyeCortex\BEC-PRIME\RUN-PROOFS\ECONOMIC'
)

$ErrorActionPreference = 'Stop'
$BaseUrl = $BaseUrl.TrimEnd('/')
$ExpectedCurrency = $ExpectedCurrency.ToLowerInvariant()

function Require-Env([string]$Name) {
    $v = [Environment]::GetEnvironmentVariable($Name)
    if ([string]::IsNullOrWhiteSpace($v)) { throw "Missing required environment variable: $Name" }
    return $v
}

function Invoke-JsonGet([string]$Uri) {
    Invoke-RestMethod -Uri $Uri -Method Get -Headers @{ 'Cache-Control' = 'no-cache' } -TimeoutSec 30
}

function Invoke-StripeGet([string]$Path, [string]$Secret) {
    $token = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes($Secret + ':'))
    Invoke-RestMethod -Uri ('https://api.stripe.com/v1/' + $Path) -Method Get -Headers @{ Authorization = 'Basic ' + $token } -TimeoutSec 30
}

function Write-AtomicText([string]$Path, [string]$Text) {
    $parent = Split-Path -Parent $Path
    if ($parent) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }
    $tmp = $Path + '.tmp.' + [guid]::NewGuid().ToString('N')
    [IO.File]::WriteAllText($tmp, $Text, [Text.Encoding]::ASCII)
    Move-Item -LiteralPath $tmp -Destination $Path -Force
}

function Write-Proof([hashtable]$Proof) {
    New-Item -ItemType Directory -Path $ProofRoot -Force | Out-Null
    $stamp = [DateTime]::UtcNow.ToString('yyyyMMdd-HHmmssfff')
    $jsonPath = Join-Path $ProofRoot ($stamp + '-ECONOMIC-PROOF.json')
    $json = $Proof | ConvertTo-Json -Depth 12
    Write-AtomicText -Path $jsonPath -Text ($json + "`r`n")
    $hash = (Get-FileHash -LiteralPath $jsonPath -Algorithm SHA256).Hash.ToLowerInvariant()
    $hashPath = $jsonPath + '.sha256'
    Write-AtomicText -Path $hashPath -Text ($hash + "`r`n")
    [pscustomobject]@{ JsonPath = $jsonPath; HashPath = $hashPath; SHA256 = $hash }
}

if ($Action -eq 'Create') {
    $health = Invoke-JsonGet -Uri ($BaseUrl + '/healthz')
    $body = @{ offer_id = $OfferId; region = 'NZ' } | ConvertTo-Json -Compress
    $checkout = Invoke-RestMethod -Uri ($BaseUrl + '/api/offer-checkout/create') -Method Post -ContentType 'application/json' -Body $body -TimeoutSec 60
    $url = [string]$checkout.checkout_url
    if ([string]::IsNullOrWhiteSpace($url)) { $url = [string]$checkout.url }
    if ([string]::IsNullOrWhiteSpace($url)) { throw 'Checkout creation returned no URL.' }
    if ($url -notmatch '^https://checkout\.stripe\.com/') { throw 'Checkout URL is not a Stripe Checkout URL.' }
    if ([int]$checkout.amount_minor -ne $ExpectedAmountMinor) { throw 'Checkout amount does not match approved offer.' }
    if ([string]$checkout.currency -ne $ExpectedCurrency) { throw 'Checkout currency does not match approved offer.' }
    $proof = [ordered]@{
        proof_type = 'CHECKOUT_INITIATED_PAYMENT_UNPROVEN'
        offer_id = $OfferId
        checkout_session_id = [string]$checkout.session_id
        amount_minor = [int]$checkout.amount_minor
        currency = [string]$checkout.currency
        created_at_utc = [DateTime]::UtcNow.ToString('o')
        payment_proven = $false
        revenue_declared = $false
        checkout_url = $url
    }
    $out = Write-Proof $proof
    Write-Host 'STATUS: CHECKOUT_CREATED_PAYMENT_UNPROVEN'
    Write-Host ('CHECKOUT_SESSION_ID: ' + $checkout.session_id)
    Write-Host ('CHECKOUT_URL: ' + $url)
    Write-Host ('PROOF: ' + $out.JsonPath)
    Write-Host ('SHA256: ' + $out.SHA256)
    Write-Host 'BLOCKER: REAL_BUYER_REQUIRED'
    exit 0
}

if (-not $CheckoutSessionId) { throw '-CheckoutSessionId is required for Verify.' }
$stripeSecret = Require-Env 'STRIPE_SECRET_KEY'
$supabaseUrl = Require-Env 'SUPABASE_URL'
$supabaseKey = Require-Env 'SUPABASE_SERVICE_KEY'

$session = Invoke-StripeGet -Path ('checkout/sessions/' + [Uri]::EscapeDataString($CheckoutSessionId)) -Secret $stripeSecret
if ([string]$session.payment_status -ne 'paid') {
    Write-Host ('STATUS: PAYMENT_UNPROVEN (' + $session.payment_status + ')')
    exit 0
}

$paymentIntentId = [string]$session.payment_intent
if ($paymentIntentId -notmatch '^pi_[A-Za-z0-9]+$') { throw 'Stripe did not return a valid PaymentIntent ID.' }
$pi = Invoke-StripeGet -Path ('payment_intents/' + [Uri]::EscapeDataString($paymentIntentId)) -Secret $stripeSecret

if ([string]$pi.status -ne 'succeeded') { throw 'PaymentIntent is not succeeded.' }
if ([int]$pi.amount -ne $ExpectedAmountMinor) { throw 'PaymentIntent amount mismatch.' }
if ([string]$pi.currency -ne $ExpectedCurrency) { throw 'PaymentIntent currency mismatch.' }
if ([string]$session.metadata.offer_id -ne $OfferId) { throw 'Checkout offer metadata mismatch.' }
if ([string]$pi.metadata.offer_id -and [string]$pi.metadata.offer_id -ne $OfferId) { throw 'PaymentIntent offer metadata mismatch.' }

$headers = @{
    apikey = $supabaseKey
    Authorization = 'Bearer ' + $supabaseKey
    'Content-Type' = 'application/json'
}
$encodedPi = [Uri]::EscapeDataString($paymentIntentId)
$existingUri = $supabaseUrl.TrimEnd('/') + '/rest/v1/economic_events?select=event_id&stripe_payment_intent=eq.' + $encodedPi + '&limit=1'
$existing = Invoke-RestMethod -Uri $existingUri -Method Get -Headers $headers -TimeoutSec 30
if ($existing.Count -gt 0) {
    Write-Host 'STATUS: DUPLICATE_ALREADY_SETTLED'
    Write-Host ('STRIPE_PAYMENT_INTENT: ' + $paymentIntentId)
    exit 0
}

$eventId = 'SALE_' + $paymentIntentId
$settled = [ordered]@{
    event_id = $eventId
    opportunity_id = $OfferId
    event_pattern_id = 'STRIPE_CHECKOUT_SESSION_COMPLETED'
    silo_id = 'dreamledger'
    sku_id = $OfferId
    offer_id = $OfferId
    buyer_action_verified = $true
    payment_settled = $true
    fulfilment_verified = $false
    evidence_verified = $true
    amount_nzd = ([decimal]$pi.amount / 100)
    stripe_checkout_session = [string]$session.id
    stripe_payment_intent = $paymentIntentId
    evidence_ref = 'stripe:payment_intent/' + $paymentIntentId
}

$body = $settled | ConvertTo-Json -Depth 12
try {
    Invoke-RestMethod -Uri ($supabaseUrl.TrimEnd('/') + '/rest/v1/economic_events') -Method Post -Headers ($headers + @{ Prefer = 'return=representation' }) -Body $body -TimeoutSec 30 | Out-Null
} catch {
    throw ('SALE_SETTLED write failed closed: ' + $_.Exception.Message)
}

$proof = [ordered]@{
    proof_type = 'ECONOMIC_PROOF'
    status = 'PASS'
    event_id = $eventId
    offer_id = $OfferId
    provider = 'stripe'
    checkout_session_id = [string]$session.id
    payment_intent_id = $paymentIntentId
    payment_status = [string]$session.payment_status
    payment_intent_status = [string]$pi.status
    amount_minor = [int]$pi.amount
    amount_nzd = ([decimal]$pi.amount / 100)
    currency = [string]$pi.currency
    verification_method = 'independent_stripe_retrieval'
    revenue_declared = $true
    created_at_utc = [DateTime]::UtcNow.ToString('o')
}
$out = Write-Proof $proof
Write-Host 'STATUS: FIRST_ECONOMIC_EVENT_PROVEN'
Write-Host ('STRIPE_PAYMENT_INTENT: ' + $paymentIntentId)
Write-Host ('PROOF: ' + $out.JsonPath)
Write-Host ('SHA256: ' + $out.SHA256)
exit 0
