#requires -Version 5.1
[CmdletBinding()]
param(
    [string]$RepoRoot = "",
    [string]$BaseUrl = "https://dreamledger.org",
    [string]$DataRoot = ""
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Ensure-Dir([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path)) {
        New-Item -ItemType Directory -Force -Path $Path | Out-Null
    }
}

function Write-Utf8([string]$Path,[string]$Content) {
    Ensure-Dir (Split-Path -Parent $Path)
    Set-Content -LiteralPath $Path -Value $Content -Encoding UTF8
}

if ([string]::IsNullOrWhiteSpace($RepoRoot)) {
    $candidates = @(
        (Get-Location).Path,
        "D:\BrownEyeCortex\BECKPrime",
        "C:\BrownEyeCortex\BECKPrime"
    )
    foreach ($candidate in $candidates) {
        if ((Test-Path -LiteralPath (Join-Path $candidate ".git")) -and (Test-Path -LiteralPath (Join-Path $candidate "package.json"))) {
            $RepoRoot = $candidate
            break
        }
        if ((Test-Path -LiteralPath (Join-Path $candidate ".git")) -and (Test-Path -LiteralPath (Join-Path $candidate "BEC-PRIME"))) {
            $RepoRoot = $candidate
            break
        }
    }
}

if ([string]::IsNullOrWhiteSpace($RepoRoot) -or -not (Test-Path -LiteralPath (Join-Path $RepoRoot ".git"))) {
    throw "Repository root not found. Run from the DreamLedger repo or pass -RepoRoot explicitly. Refusing to write outside the repo."
}

$PublicDir = Join-Path $RepoRoot "public"
$IndexPath = Join-Path $PublicDir "index.html"
if (-not (Test-Path -LiteralPath $IndexPath)) {
    throw "Missing public/index.html at $IndexPath"
}

if ([string]::IsNullOrWhiteSpace($DataRoot)) {
    $DataRoot = if (Test-Path "D:\") { "D:\BrownEyeCortex\Runtime" } else { Join-Path $RepoRoot "RUN-PROOFS" }
}
$ProofRoot = Join-Path $DataRoot "proofs"
Ensure-Dir $ProofRoot

$today = (Get-Date).ToUniversalTime().ToString("yyyy-MM-dd")

$robots = @(
    "User-agent: *"
    "Allow: /"
    "Disallow: /api/"
    "Disallow: /admin/"
    "Disallow: /internal/"
    "Disallow: /debug/"
    "Sitemap: $BaseUrl/sitemap.xml"
) -join "`n"
Write-Utf8 (Join-Path $PublicDir "robots.txt") ($robots + "`n")

$routes = @(
    @{ path="/"; priority="1.0"; freq="weekly" }
    @{ path="/billboard"; priority="0.9"; freq="weekly" }
    @{ path="/mtg"; priority="0.9"; freq="weekly" }
    @{ path="/avatar"; priority="0.7"; freq="weekly" }
)

$sitemap = New-Object System.Text.StringBuilder
[void]$sitemap.AppendLine('<?xml version="1.0" encoding="UTF-8"?>')
[void]$sitemap.AppendLine('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')
foreach ($route in $routes) {
    [void]$sitemap.AppendLine("  <url>")
    [void]$sitemap.AppendLine("    <loc>$BaseUrl$($route.path)</loc>")
    [void]$sitemap.AppendLine("    <lastmod>$today</lastmod>")
    [void]$sitemap.AppendLine("    <changefreq>$($route.freq)</changefreq>")
    [void]$sitemap.AppendLine("    <priority>$($route.priority)</priority>")
    [void]$sitemap.AppendLine("  </url>")
}
[void]$sitemap.AppendLine('</urlset>')
Write-Utf8 (Join-Path $PublicDir "sitemap.xml") $sitemap.ToString()

$html = Get-Content -LiteralPath $IndexPath -Raw

$markerStart = '<!-- BEC SEO v2 START -->'
$markerEnd = '<!-- BEC SEO v2 END -->'
$seoBlock = @"
$markerStart
<title>DreamLedger | Discover things worth buying</title>
<meta name="description" content="DreamLedger is a discovery-led marketplace for digital products, physical collectibles, interactive experiences, and media." />
<meta name="robots" content="index,follow" />
<link rel="canonical" href="$BaseUrl/" />
<meta property="og:title" content="DreamLedger | Discover things worth buying" />
<meta property="og:description" content="Digital products, physical collectibles, interactive experiences, and media in one discovery-led marketplace." />
<meta property="og:url" content="$BaseUrl/" />
<meta property="og:type" content="website" />
$markerEnd
"@

$pattern = '(?s)<!-- BEC SEO v2 START -->.*?<!-- BEC SEO v2 END -->'
if ($html -match $pattern) {
    $html = [regex]::Replace($html, $pattern, [System.Text.RegularExpressions.MatchEvaluator]{ param($m) $seoBlock }, 1)
} else {
    $html = $html -replace '<head>', "<head>`n$seoBlock"
}

$jsonLd = @'
<script type="application/ld+json">
{
  "@context":"https://schema.org",
  "@type":"Organization",
  "name":"DreamLedger",
  "url":"https://dreamledger.org",
  "sameAs":["https://github.com/KelpCoin/DreamLedger"]
}
</script>
'@

$jsonLdMarker = '<!-- BEC JSON-LD v2 -->'
if ($html -notmatch [regex]::Escape($jsonLdMarker)) {
    $jsonLdBlock = $jsonLdMarker + "`n" + $jsonLd
    $html = $html -replace '</head>', "$jsonLdBlock`n</head>"
}

Write-Utf8 $IndexPath $html

$checks = @(
    [pscustomobject]@{ name="repo_root_is_git_repo"; status=($(if(Test-Path (Join-Path $RepoRoot '.git')){'PASS'}else{'FAIL'})); detail=$RepoRoot }
    [pscustomobject]@{ name="public_index_exists"; status=($(if(Test-Path $IndexPath){'PASS'}else{'FAIL'})); detail=$IndexPath }
    [pscustomobject]@{ name="robots_exists"; status=($(if(Test-Path (Join-Path $PublicDir 'robots.txt')){'PASS'}else{'FAIL'})); detail=(Join-Path $PublicDir 'robots.txt') }
    [pscustomobject]@{ name="sitemap_exists"; status=($(if(Test-Path (Join-Path $PublicDir 'sitemap.xml')){'PASS'}else{'FAIL'})); detail=(Join-Path $PublicDir 'sitemap.xml') }
    [pscustomobject]@{ name="canonical_present"; status=($(if($html -match 'rel="canonical"'){ 'PASS' } else { 'FAIL' })); detail=$BaseUrl }
    [pscustomobject]@{ name="json_ld_present"; status=($(if($html -match 'application/ld\+json'){ 'PASS' } else { 'FAIL' })); detail='Organization JSON-LD' }
    [pscustomobject]@{ name="sitemap_declared_in_robots"; status=($(if($robots -match [regex]::Escape("Sitemap: $BaseUrl/sitemap.xml")){ 'PASS' } else { 'FAIL' })); detail='robots.txt sitemap declaration' }
)

$failed = @($checks | Where-Object status -eq 'FAIL')
$proof = [ordered]@{
    schema='DREAMLEDGER-SEO-PROOF/v2'
    status=$(if($failed.Count -eq 0){'PASS'}else{'FAIL'})
    repo=$RepoRoot
    public_dir=$PublicDir
    base_url=$BaseUrl
    checks=$checks
    note='SEO bootstrap is repo-safe and writes static discoverability metadata; it does not claim search-engine indexing.'
    verified_at_utc=(Get-Date).ToUniversalTime().ToString('o')
}
Write-Json (Join-Path $ProofRoot 'SEO-BOOTSTRAP-LATEST.json') $proof

$checks | Format-Table -AutoSize
if ($failed.Count -gt 0) { throw 'SEO bootstrap verification failed.' }
Write-Host 'SEO-BOOTSTRAP PASS' -ForegroundColor Green
Write-Host ('Proof: ' + (Join-Path $ProofRoot 'SEO-BOOTSTRAP-LATEST.json')) -ForegroundColor Green
