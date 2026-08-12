param(
    [Parameter(Mandatory = $true)]
    [string]$TargetUrl,
    [string]$OutputDir = "$PSScriptRoot\..\Proof\SurfaceAudits"
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

if ($TargetUrl -notmatch '^https://') { throw 'TargetUrl must use HTTPS.' }
if (-not (Test-Path $OutputDir)) { New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null }

$started = (Get-Date).ToUniversalTime()
$html = ''
$httpStatus = $null
$finalUrl = $TargetUrl
$errors = @()

try {
    $response = Invoke-WebRequest -Uri $TargetUrl -TimeoutSec 20 -UseBasicParsing -MaximumRedirection 5
    $html = [string]$response.Content
    $httpStatus = [int]$response.StatusCode
    if ($response.BaseResponse.ResponseUri) { $finalUrl = [string]$response.BaseResponse.ResponseUri.AbsoluteUri }
} catch {
    $errors += "target_fetch: $($_.Exception.Message)"
}

function Test-ContainsAny {
    param([string]$Text, [string[]]$Patterns)
    foreach ($pattern in $Patterns) {
        if ($Text -match $pattern) { return $true }
    }
    return $false
}

$hasJsonLd = Test-ContainsAny -Text $html -Patterns @('application/ld\\+json', 'application/ld\\+json')
$hasProductSchema = $false
$hasOfferSchema = $false
foreach ($match in [regex]::Matches($html, '<script[^>]+type=["'']application/ld\\+json["''][^>]*>(.*?)</script>', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase -bor [System.Text.RegularExpressions.RegexOptions]::Singleline)) {
    $block = $match.Groups[1].Value
    if ($block -match '"@type"\s*:\s*"Product"') { $hasProductSchema = $true }
    if ($block -match '"@type"\s*:\s*"Offer"') { $hasOfferSchema = $true }
}

$hasPrice = Test-ContainsAny -Text $html -Patterns @('priceCurrency', 'price', '\\$[0-9][0-9,]*(\\.[0-9]+)?', 'NZD', 'USD', 'EUR')
$hasAvailability = Test-ContainsAny -Text $html -Patterns @('availability', 'InStock', 'OutOfStock', 'in stock', 'available', 'sold out')
$hasCheckout = Test-ContainsAny -Text $html -Patterns @('checkout', 'add to cart', 'buy now', 'purchase', 'subscribe')

$robotsAllowed = $null
$robotsUrl = ($TargetUrl.TrimEnd('/')) + '/robots.txt'
try {
    $robots = Invoke-WebRequest -Uri $robotsUrl -TimeoutSec 10 -UseBasicParsing
    $robotsText = [string]$robots.Content
    $robotsAllowed = -not ($robotsText -match '(?im)^User-agent:\s*\\*' -and $robotsText -match '(?im)^Disallow:\s*/\s*$')
} catch {
    $robotsAllowed = $null
    $errors += "robots_fetch: $($_.Exception.Message)"
}

$understand = 0
if ($hasJsonLd) { $understand += 50 }
if ($hasProductSchema -or $hasOfferSchema) { $understand += 50 }

$decide = 0
if ($hasPrice) { $decide += 60 }
if ($hasAvailability) { $decide += 40 }

$act = 0
if ($robotsAllowed -eq $true) { $act += 40 }
if ($hasCheckout) { $act += 60 }

$overall = [math]::Round(($understand + $decide + $act) / 3, 2)
$finished = (Get-Date).ToUniversalTime()
$stamp = $finished.ToString('yyyyMMdd-HHmmss')
$outFile = Join-Path $OutputDir "surface-audit-$stamp.json"

$proof = [ordered]@{
    schema_version = 'BEC-SURFACE-AUDIT-1.0'
    event = 'surface.audit.completed'
    evidence_level = 2
    status = 'OBSERVED'
    target_url = $TargetUrl
    final_url = $finalUrl
    http_status = $httpStatus
    dimensions = [ordered]@{
        understand = $understand
        decide = $decide
        act = $act
        overall = $overall
    }
    findings = [ordered]@{
        json_ld = $hasJsonLd
        product_schema = $hasProductSchema
        offer_schema = $hasOfferSchema
        price_signal = $hasPrice
        availability_signal = $hasAvailability
        robots_allows_crawlers = $robotsAllowed
        checkout_signal = $hasCheckout
    }
    errors = @($errors)
    started_utc = $started.ToString('o')
    completed_utc = $finished.ToString('o')
}

$proof | ConvertTo-Json -Depth 10 | Set-Content -Path $outFile -Encoding UTF8
Write-Host "SURFACE_AUDIT_WRITTEN=$outFile"
Write-Host "UNDERSTAND=$understand DECIDE=$decide ACT=$act OVERALL=$overall"
