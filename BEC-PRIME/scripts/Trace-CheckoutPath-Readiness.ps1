$ErrorActionPreference = 'Stop'

$base = 'https://dreamledger.org'
$productId = 'AGENTIC-COMMERCE-READINESS-001'
$expectedAmount = 49
$expectedCurrency = 'NZD'
$proofDir = Join-Path $PSScriptRoot '..\RUN-PROOFS'
$proofDir = [IO.Path]::GetFullPath($proofDir)
New-Item -ItemType Directory -Force -Path $proofDir | Out-Null

$results = [ordered]@{
    timestamp_utc = [DateTime]::UtcNow.ToString('o')
    product_id = $productId
    expected_amount = $expectedAmount
    expected_currency = $expectedCurrency
    checks = @()
}

function Add-Check($name, $status, $detail) {
    $script:results.checks += [ordered]@{ name=$name; status=$status; detail=$detail }
}

try {
    $health = Invoke-WebRequest -Uri "$base/api/healthz" -Method Get -TimeoutSec 15 -UseBasicParsing
    Add-Check 'healthz' 'PASS' ("HTTP " + [int]$health.StatusCode)
} catch {
    Add-Check 'healthz' 'FAIL' $_.Exception.Message
}

try {
    $body = @{ offer_id=$productId; currency=$expectedCurrency; amount=$expectedAmount; lane='READINESS'; flow_id=('FLOW_READINESS_' + [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()) } | ConvertTo-Json
    $response = Invoke-RestMethod -Uri "$base/api/offer-checkout/create" -Method Post -Body $body -ContentType 'application/json' -TimeoutSec 30
    if ([string]::IsNullOrWhiteSpace([string]$response.url)) {
        Add-Check 'checkout' 'FAIL' ('Response did not contain a checkout URL: ' + ($response | ConvertTo-Json -Compress))
    } else {
        $checkoutUrl = [string]$response.url
        try {
            $uri = [Uri]$checkoutUrl
            if ($uri.Scheme -ne 'https' -or $uri.Host -notmatch 'stripe\.com$') {
                Add-Check 'checkout_url' 'FAIL' ('Unexpected checkout host: ' + $uri.Host)
            } else {
                Add-Check 'checkout_url' 'PASS' ('Stripe Checkout URL returned: ' + $uri.Host)
                $results.checkout_url = $checkoutUrl
            }
        } catch {
            Add-Check 'checkout_url' 'FAIL' ('Invalid checkout URL: ' + $checkoutUrl)
        }
    }
} catch {
    Add-Check 'checkout' 'FAIL' $_.Exception.Message
}

$results.status = if (($results.checks | Where-Object { $_.status -eq 'FAIL' }).Count -eq 0) { 'PASS' } else { 'FAIL' }
$out = Join-Path $proofDir 'FIRST-CHECKOUT-TRACE-READINESS.json'
$results | ConvertTo-Json -Depth 8 | Set-Content -Encoding UTF8 $out
Write-Host ($results | ConvertTo-Json -Depth 8)
Write-Host "Proof: $out"
if ($results.checkout_url) { $results.checkout_url | Set-Clipboard; Write-Host 'Stripe Checkout URL copied to clipboard.' }
if ($results.status -ne 'PASS') { exit 1 }
