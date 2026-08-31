#requires -Version 5.1
[CmdletBinding()]
param(
    [string]$RepoRoot = "D:\BrownEyeCortex\BECKPrime",
    [string]$BaseUrl = "https://dreamledger.org",
    [switch]$Compile
)

$ErrorActionPreference = "Stop"
$ErrorCount = 0
$Results = New-Object System.Collections.Generic.List[object]
$Root = $RepoRoot
$DataRoot = if (Test-Path "D:\") { "D:\BrownEyeCortex\Runtime" } else { "C:\BrownEyeCortex\Runtime" }
$ProofRoot = Join-Path $DataRoot "proofs"
$LogRoot = Join-Path $DataRoot "logs"
New-Item -ItemType Directory -Force -Path $ProofRoot,$LogRoot | Out-Null

function Check([string]$Name,[bool]$Pass,[string]$Detail) {
    $Results.Add([ordered]@{name=$Name;status=if($Pass){"PASS"}else{"FAIL"};detail=$Detail}) | Out-Null
    if (-not $Pass) { $script:ErrorCount++ }
}

function Has([string]$RelativePath) {
    return (Test-Path -LiteralPath (Join-Path $Root $RelativePath))
}

function Get-StatusCode([string]$Uri) {
    try {
        return [int](Invoke-WebRequest -Uri $Uri -Method Head -UseBasicParsing -TimeoutSec 20).StatusCode
    } catch {
        try { return [int](Invoke-WebRequest -Uri $Uri -Method Get -UseBasicParsing -TimeoutSec 20).StatusCode } catch { return 0 }
    }
}

Write-Host "=== BECK ENTERPRISE COMMERCE PREFLIGHT ===" -ForegroundColor Cyan

Check "repo-exists" (Test-Path $Root) $Root
Check "package-exists" (Has "BEC-PRIME\package.json") "BEC-PRIME/package.json"
Check "bec-command" (Has "BEC-PRIME\bec.cmd") "BEC-PRIME/bec.cmd"
Check "universal-compiler" (Has "BEC-PRIME\compiler\UniversalCompiler.js") "UniversalCompiler.js"
Check "product-compiler" (Has "BEC-PRIME\compiler\ProductCompiler.js") "ProductCompiler.js"
Check "offer-compiler" (Has "BEC-PRIME\compiler\OfferCompiler.js") "OfferCompiler.js"
Check "billboard-compiler" (Has "BEC-PRIME\compiler\BillboardCompiler.js") "BillboardCompiler.js"
Check "public-surface-verifier" (Has "BEC-PRIME\scripts\verify-public-surface.js") "verify-public-surface.js"
Check "production-contract-verifier" (Has "BEC-PRIME\scripts\verify-production-contract.js") "verify-production-contract.js"
Check "commerce-integration-verifier" (Has "BEC-PRIME\scripts\verify-commercial-integration.js") "verify-commercial-integration.js"
Check "silo-boundary-verifier" (Has "BEC-PRIME\scripts\verify-silo-boundaries.js") "verify-silo-boundaries.js"
Check "runtime-verifier" (Has "BEC-PRIME\scripts\Verify-Runtime.js") "Verify-Runtime.js"
Check "startup-repair" (Has "BEC-PRIME\scripts\Repair-BECStartup.ps1") "Repair-BECStartup.ps1"

if (Get-Command node.exe -ErrorAction SilentlyContinue) { Check "node" $true ((node --version) -join " ") } else { Check "node" $false "node.exe not found" }
if (Get-Command npm.cmd -ErrorAction SilentlyContinue) { Check "npm" $true ((npm.cmd --version) -join " ") } else { Check "npm" $false "npm.cmd not found" }
if (Get-Command git.exe -ErrorAction SilentlyContinue) { Check "git" $true ((git --version) -join " ") } else { Check "git" $false "git.exe not found" }

if (Test-Path (Join-Path $Root ".git")) {
    Push-Location $Root
    try {
        $sha = (git rev-parse HEAD 2>$null)
        Check "git-repository" ($LASTEXITCODE -eq 0) ([string]$sha)
    } finally { Pop-Location }
}

$becStatus = Join-Path $Root "BEC-PRIME\bec.cmd"
if (Test-Path $becStatus) {
    Push-Location (Join-Path $Root "BEC-PRIME")
    try {
        & cmd.exe /c "bec.cmd status" *>&1 | Tee-Object -FilePath (Join-Path $LogRoot "enterprise-bec-status.log") | Out-Host
        Check "bec-status" ($LASTEXITCODE -eq 0) "BEC control point"
    } finally { Pop-Location }
}

if ($Compile) {
    Push-Location (Join-Path $Root "BEC-PRIME")
    try {
        npm.cmd run compile *>&1 | Tee-Object -FilePath (Join-Path $LogRoot "enterprise-compile.log") | Out-Host
        Check "canonical-compile" ($LASTEXITCODE -eq 0) "npm run compile"
    } finally { Pop-Location }
}

$requiredPublic = @("/","/billboard","/healthz","/version","/api/products")
foreach ($path in $requiredPublic) {
    $code = Get-StatusCode ($BaseUrl.TrimEnd('/') + $path)
    Check ("http" + $path) ($code -ge 200 -and $code -lt 400) ([string]$code)
}

$robotsCode = Get-StatusCode ($BaseUrl.TrimEnd('/') + "/robots.txt")
$sitemapCode = Get-StatusCode ($BaseUrl.TrimEnd('/') + "/sitemap.xml")
Check "http-robots" ($robotsCode -ge 200 -and $robotsCode -lt 400) ([string]$robotsCode)
Check "http-sitemap" ($sitemapCode -ge 200 -and $sitemapCode -lt 400) ([string]$sitemapCode)

$proof = [ordered]@{
    schema="BECK-ENTERPRISE-COMMERCE-PREFLIGHT/v1"
    status=if($ErrorCount -eq 0){"PASS"}else{"FAIL"}
    repo=$Root
    base_url=$BaseUrl
    generated_at_utc=(Get-Date).ToUniversalTime().ToString("o")
    checks=$Results
    next_gate=if($ErrorCount -eq 0){"RUNTIME_COMMERCE_AND_PAYMENT_PROOF"}else{"REPAIR_FAILED_PREFLIGHT_CHECKS"}
}
$out = Join-Path $ProofRoot "BECK-ENTERPRISE-PREFLIGHT-LATEST.json"
$proof | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $out -Encoding UTF8

Write-Host ""
Write-Host ("PREFLIGHT STATUS: " + $proof.status) -ForegroundColor $(if($proof.status -eq "PASS"){"Green"}else{"Red"})
Write-Host ("PROOF: " + $out)

if ($ErrorCount -gt 0) { exit 1 }
exit 0
