#requires -Version 5.1
[CmdletBinding()]
param(
    [Parameter(Mandatory = $false)]
    [string]$ExpectedCommit = ''
)

$ErrorActionPreference = 'Stop'
$Base = 'https://dreamledger.org'
if ([string]::IsNullOrWhiteSpace($ExpectedCommit)) {
    $ExpectedCommit = (git rev-parse HEAD).Trim()
}

$ProofDir = Join-Path (Split-Path -Parent $PSScriptRoot) 'proof'
New-Item -ItemType Directory -Force -Path $ProofDir | Out-Null
$results = @()
$failures = New-Object System.Collections.Generic.List[string]

function Test-Route {
    param([string]$Path,[int]$ExpectedStatus = 200,[string]$Marker = '')
    try {
        $r = Invoke-WebRequest -Uri ($Base + $Path) -UseBasicParsing -TimeoutSec 20
        $body = [string]$r.Content
        $markerOk = [string]::IsNullOrWhiteSpace($Marker) -or $body.Contains($Marker)
        $ok = ($r.StatusCode -eq $ExpectedStatus) -and $markerOk
        $results += [pscustomobject]@{ path=$Path; status=[int]$r.StatusCode; marker=$Marker; marker_ok=$markerOk; pass=$ok }
        if (-not $ok) { $failures.Add($Path) }
    }
    catch {
        $status = 0
        if ($_.Exception.Response) { try { $status = [int]$_.Exception.Response.StatusCode.value__ } catch {} }
        $ok = ($ExpectedStatus -eq 404 -and $status -eq 404)
        $results += [pscustomobject]@{ path=$Path; status=$status; marker=$Marker; marker_ok=$false; pass=$ok; error=$_.Exception.Message }
        if (-not $ok) { $failures.Add($Path) }
    }
}

Test-Route '/' 200 'Agentic Sovereignty Diagnostic'
Test-Route '/' 200 'NZ$29'
Test-Route '/' 200 'buy.stripe.com/9B6fZh6Hz7tPgyP3gwdwc1M'
Test-Route '/' 200 'Evidence, Not Hype.'
Test-Route '/healthz' 200 '"status":"ok"'
Test-Route '/version' 200 'production-version-v1'
Test-Route '/cinema.html' 404

$version = $null
try { $version = Invoke-RestMethod ($Base + '/version') -TimeoutSec 20 } catch { $failures.Add('/version-json') }
$deployedCommit = if ($version) { [string]$version.commit } else { '' }
$shaMatch = $deployedCommit -eq $ExpectedCommit
if (-not $shaMatch) { $failures.Add('version.commit') }

$rootBody = ''
try { $rootBody = [string](Invoke-WebRequest -Uri $Base -UseBasicParsing -TimeoutSec 20).Content } catch { $failures.Add('/') }
$legacyTokens = @('Cinema Player','Truth Oracle','Commander Deck Diagnostic','/dreamiez/')
$legacyHits = @($legacyTokens | Where-Object { $rootBody.Contains($_) })
if ($legacyHits.Count -gt 0) { $failures.Add('legacy-surface') }

$pass = ($failures.Count -eq 0)
$proof = [ordered]@{
    proof_version = 'dreamledger-production-truth-v3'
    checked_at = (Get-Date).ToUniversalTime().ToString('o')
    base = $Base
    expected_commit = $ExpectedCommit
    deployed_commit = $deployedCommit
    sha_match = $shaMatch
    routes = $results
    checkout_url = 'https://buy.stripe.com/9B6fZh6Hz7tPgyP3gwdwc1M'
    offer = 'Agentic Sovereignty Diagnostic'
    price_nzd = 29
    legacy_hits = @($legacyHits)
    deployment_proof = if ($pass) { 'VALID' } else { 'PENDING' }
    production_truth = $pass
    production_pass = $pass
    first_economic_proof = $false
    sale_settled = $false
    revenue_nzd = 0
    failures = @($failures)
}

$timestamp = (Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssZ')
$path = Join-Path $ProofDir ("ProductionTruth-{0}.json" -f $timestamp)
$proof | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $path -Encoding UTF8
$latest = Join-Path $ProofDir 'LATEST.json'
$proof | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $latest -Encoding UTF8
$proof | ConvertTo-Json -Depth 8
if (-not $pass) { exit 1 }
