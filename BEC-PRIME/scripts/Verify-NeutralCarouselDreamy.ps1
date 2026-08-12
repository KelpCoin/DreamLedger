$ErrorActionPreference = 'Stop'
$BaseUrl = if ($env:DREAMLEDGER_BASE_URL) { $env:DREAMLEDGER_BASE_URL.TrimEnd('/') } else { 'https://dreamledger.org' }
$Stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$ProofDir = 'D:\BrownEyeCortex\BEC-PRIME\Proof\Surface'
New-Item -ItemType Directory -Path $ProofDir -Force | Out-Null
$ProofPath = Join-Path $ProofDir "NEUTRAL-CAROUSEL-DREAMY-$Stamp.json"

$home = Invoke-WebRequest -Uri "$BaseUrl/" -UseBasicParsing -TimeoutSec 20
$reg = Invoke-WebRequest -Uri "$BaseUrl/dreamiez/register.html" -UseBasicParsing -TimeoutSec 20

$checks = [ordered]@{
    homepage_http_200 = ($home.StatusCode -eq 200)
    horizontal_world_rail = ($home.Content -match 'overflow-x:auto' -and $home.Content -match 'scroll-snap-type:x mandatory')
    no_root_product_loader = ($home.Content -notmatch 'id="product-rail"' -and $home.Content -notmatch '/api/products')
    dreamy_top_right_cta = ($home.Content -match 'Make your Dreamy' -and $home.Content -match '/dreamiez/register.html')
    neutral_host_copy = ($home.Content -match 'Neutral front door' -and $home.Content -match 'ONE HOST')
    mtg_isolated_entry = ($home.Content -match 'Magic: The Gathering' -and $home.Content -match 'Independent silo' -and $home.Content -match 'href="/mtg"')
    dreamiez_account_page_http_200 = ($reg.StatusCode -eq 200)
    dreamiez_account_endpoint_present = ($reg.Content -match '/api/dreamiez/account/create')
    no_fake_catalog_on_home = ($home.Content -notmatch 'Buy now' -and $home.Content -notmatch 'Available now' -and $home.Content -notmatch 'Loading the catalog')
}

$pass = @($checks.Values | Where-Object { -not $_ }).Count -eq 0
$proof = [ordered]@{
    type = 'dreamledger-neutral-carousel-dreamy-verification'
    timestamp = (Get-Date).ToUniversalTime().ToString('o')
    base_url = $BaseUrl
    status = if ($pass) { 'PASS' } else { 'FAIL' }
    checks = $checks
    revenue_truth = 'UNCHANGED: no payment is claimed by this surface repair'
    scope = @(
        'Restore neutral homepage instead of mixed product catalogue',
        'Use horizontal swipe-first world carousel',
        'Move Dreamy creation to account entry surface',
        'Keep MTG behind its own silo route',
        'Do not invent or expose new root products'
    )
}
$proof | ConvertTo-Json -Depth 10 | Set-Content -Path $ProofPath -Encoding UTF8
Write-Host "STATUS: $($proof.status)"
Write-Host "PROOF: $ProofPath"
if (-not $pass) { $checks.GetEnumerator() | Where-Object { -not $_.Value } | ForEach-Object { Write-Host "FAIL: $($_.Key)" }; exit 1 }
Write-Host 'PASS: neutral carousel, Dreamy account CTA, and root catalogue isolation verified.'
