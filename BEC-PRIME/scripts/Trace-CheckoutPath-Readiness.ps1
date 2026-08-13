$ErrorActionPreference = 'Stop'

$base = 'https://dreamledger.org'
$productId = 'AGENTIC-COMMERCE-READINESS-001'
$proofDir = Join-Path $PSScriptRoot '..\RUN-PROOFS'
$proofDir = [IO.Path]::GetFullPath($proofDir)
New-Item -ItemType Directory -Force -Path $proofDir | Out-Null

$results = [ordered]@{
    timestamp_utc = [DateTime]::UtcNow.ToString('o')
    product_id = $productId
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
    $body = @{ offer_id=$productId; currency='NZD'; amount=49; lane='READINESS'; flow_id=('FLOW_READINESS_' + [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()) } | ConvertTo-Json
    $response = Invoke-RestMethod -Uri "$base/api/offer-checkout/create" -Method Post -Body $body -ContentType 'application/json' -TimeoutSec 30
    if ([string]::IsNullOrWhiteSpace([string]$response.url)) {
        Add-Check 'checkout' 'FAIL' ('Response did not contain a checkout URL: ' + ($response | ConvertTo-Json -Compress))
    } else {
        Add-Check 'checkout' 'PASS' 'Live checkout URL returned'
        $results.checkout_url = [string]$response.url
    }
} catch {
    Add-Check 'checkout' 'FAIL' $_.Exception.Message
}

$results.status = if (($results.checks | Where-Object { $_.status -eq 'FAIL' }).Count -eq 0) { 'PASS' } else { 'FAIL' }
$out = Join-Path $proofDir 'FIRST-CHECKOUT-TRACE-READINESS.json'
$results | ConvertTo-Json -Depth 8 | Set-Content -Encoding UTF8 $out
Write-Host ($results | ConvertTo-Json -Depth 8)
Write-Host "Proof: $out"
if ($results.checkout_url) { $results.checkout_url | Set-Clipboard; Write-Host 'Checkout URL copied to clipboard.' }
if ($results.status -ne 'PASS') { exit 1 }
