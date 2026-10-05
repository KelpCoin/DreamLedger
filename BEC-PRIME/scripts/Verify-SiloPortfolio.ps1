[CmdletBinding()]
param(
    [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
)

$ErrorActionPreference = 'Stop'
Set-Location $RepoRoot

$compiler = Join-Path $RepoRoot 'compiler\SiloPortfolioCompiler.js'
$source = Join-Path $RepoRoot 'catalog\offers\approved.json'
$catalog = Join-Path $RepoRoot 'catalog\compiled\silo-portfolio.json'
$proof = Join-Path $RepoRoot 'PROOF-SILO-PORTFOLIO-COMPILATION.json'
$surface = Join-Path $RepoRoot 'compiled\website\portfolio\index.html'
$carousel = Join-Path $RepoRoot '..\public\portfolio\carousel-manifest.json'

foreach ($path in @($compiler,$source)) {
    if (-not (Test-Path $path)) { throw "Missing required compiler input: $path" }
}

node $compiler
if ($LASTEXITCODE -ne 0) { throw "Silo portfolio compiler failed with exit code $LASTEXITCODE" }

if (-not (Test-Path $catalog)) { throw "Compiled silo portfolio missing: $catalog" }
if (-not (Test-Path $proof)) { throw "Compilation proof missing: $proof" }
if (-not (Test-Path $surface)) { throw "Portfolio surface missing: $surface" }
if (-not (Test-Path $carousel)) { throw "Trend-aware carousel manifest missing: $carousel" }

$data = Get-Content $catalog -Raw | ConvertFrom-Json
$proofData = Get-Content $proof -Raw | ConvertFrom-Json

if ($proofData.status -ne 'PASS') { throw 'Portfolio compilation proof is not PASS' }
if ([int]$data.offer_count -lt 1) { throw 'No approved commercial offers compiled' }
if ($data.activation_policy.approval_required_for_activation -ne $true) { throw 'Approval gate was not preserved' }
if ($data.activation_policy.only_operator_approved_offers -ne $true) { throw 'Unapproved offers entered the portfolio' }
if ($data.activation_policy.only_active_livemode_stripe_links -ne $true) { throw 'Non-live checkout entered the portfolio' }
if ($data.activation_policy.payment_claims_allowed -ne $false) { throw 'Portfolio compiler created a payment claim' }
$carouselData = Get-Content $carousel -Raw | ConvertFrom-Json
if ($carouselData.schema -ne 'BEC-PRIME/SILO-CAROUSEL-MANIFEST/v1') { throw 'Invalid silo carousel manifest schema' }
if ($carouselData.rules.unknown_is_not_zero -ne $true) { throw 'Trend unknown state is unsafe' }
if ($carouselData.rules.trend_changes_do_not_create_revenue -ne $true) { throw 'Trend layer crossed economic truth boundary' }

$record = [ordered]@{
    schema = 'BEC-PRIME/SILO-PORTFOLIO-VERIFIER/v1'
    status = 'PASS'
    verified_at = (Get-Date).ToUniversalTime().ToString('o')
    offer_count = [int]$data.offer_count
    compiler = $compiler.Replace($RepoRoot,'').TrimStart('\')
    catalog = $catalog.Replace($RepoRoot,'').TrimStart('\')
    surface = $surface.Replace($RepoRoot,'').TrimStart('\')
    carousel_manifest = $carousel.Replace($RepoRoot,'').TrimStart('\')
    gates = [ordered]@{
        approval_required_for_activation = $true
        only_operator_approved_offers = $true
        only_active_livemode_stripe_links = $true
        payment_claimed = $false
        trend_changes_create_revenue = $false
        external_actions_allowed = $false
    }
}

$verifyPath = Join-Path $RepoRoot 'PROOF-SILO-PORTFOLIO-VERIFICATION.json'
$record | ConvertTo-Json -Depth 10 | Set-Content $verifyPath -Encoding utf8
Write-Host 'SILO PORTFOLIO VERIFICATION: PASS' -ForegroundColor Green
Write-Host "Approved offers compiled: $($data.offer_count)"
Write-Host "Proof: $verifyPath"
