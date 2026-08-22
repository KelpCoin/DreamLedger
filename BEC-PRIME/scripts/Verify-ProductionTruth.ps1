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
        $r = Invoke-WebRequest -Uri ($Base + $Path) -UseBasicParsing -TimeoutSec 15
        $body = [string]$r.Content
        $markerOk = [string]::IsNullOrWhiteSpace($Marker) -or $body.Contains($Marker)
        $ok = ($r.StatusCode -eq $ExpectedStatus) -and $markerOk
        $results += [pscustomobject]@{ path=$Path; status=[int]$r.StatusCode; marker=$Marker; marker_ok=$markerOk; pass=$ok }
        if (-not $ok) { $failures.Add($Path) }
    }
    catch {
        $results += [pscustomobject]@{ path=$Path; status=0; marker=$Marker; marker_ok=$false; pass=$false; error=$_.Exception.Message }
        $failures.Add($Path)
    }
}

Test-Route '/healthz' 200
Test-Route '/version' 200
Test-Route '/mtg' 200
Test-Route '/cinema.html' 200 'cinema-event-v1'
Test-Route '/truth-oracle.html' 200 'DreamLedger Truth Oracle'
Test-Route '/truth-oracle.json' 200 'truth-oracle-v1'
Test-Route '/transparency-policy.json' 200 'DREAMLEDGER/PROGRESSIVE-TRANSPARENCY/v1'

$version = $null
try { $version = Invoke-RestMethod ($Base + '/version') -TimeoutSec 15 } catch { $failures.Add('/version-json') }
$deployedCommit = if ($version) { [string]$version.commit } else { '' }
$shaMatch = $deployedCommit -eq $ExpectedCommit
if (-not $shaMatch) { $failures.Add('version.commit') }

$pass = ($failures.Count -eq 0)
$proof = [ordered]@{
    proof_version = 'dreamledger-production-truth-v1'
    checked_at = (Get-Date).ToUniversalTime().ToString('o')
    base = $Base
    expected_commit = $ExpectedCommit
    deployed_commit = $deployedCommit
    sha_match = $shaMatch
    routes = $results
    deployment_proof = if ($pass) { 'VALID' } else { 'PENDING' }
    production_pass = $pass
    first_economic_proof = $false
    sale_settled = $false
    revenue_nzd = 0
    failures = @($failures)
}

$path = Join-Path $ProofDir 'PRODUCTION-TRUTH-PROOF.json'
$proof | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $path -Encoding UTF8
$proof | ConvertTo-Json -Depth 8
if (-not $pass) { exit 1 }
