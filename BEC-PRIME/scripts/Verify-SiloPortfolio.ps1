[CmdletBinding()]
param(
    [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
)

$ErrorActionPreference = 'Stop'
Set-Location $RepoRoot

$compiler = Join-Path $RepoRoot 'compiler\SiloPortfolioCompiler.js'
$source = Join-Path $RepoRoot 'PROOF-2026-08-11-MONETIZATION-WEDGE-PORTFOLIO.json'
$catalog = Join-Path $RepoRoot 'catalog\compiled\silo-portfolio.json'
$proof = Join-Path $RepoRoot 'PROOF-SILO-PORTFOLIO-COMPILATION.json'
$surface = Join-Path $RepoRoot 'compiled\website\portfolio\index.html'

foreach ($path in @($compiler,$source)) {
    if (-not (Test-Path $path)) { throw "Missing required compiler input: $path" }
}

node $compiler
if ($LASTEXITCODE -ne 0) { throw "Silo portfolio compiler failed with exit code $LASTEXITCODE" }

if (-not (Test-Path $catalog)) { throw "Compiled silo portfolio missing: $catalog" }
if (-not (Test-Path $proof)) { throw "Compilation proof missing: $proof" }
if (-not (Test-Path $surface)) { throw "Portfolio surface missing: $surface" }

$data = Get-Content $catalog -Raw | ConvertFrom-Json
$proofData = Get-Content $proof -Raw | ConvertFrom-Json

if ($proofData.status -ne 'PASS') { throw 'Portfolio compilation proof is not PASS' }
if ([int]$data.wedge_count -lt 1) { throw 'No monetization wedges compiled' }
if ($data.activation_policy.approval_required -ne $true) { throw 'Approval gate was not preserved' }
if ($data.activation_policy.checkout_available -ne $false) { throw 'Portfolio compiler unlocked checkout' }
if ($data.activation_policy.payment_claims_allowed -ne $false) { throw 'Portfolio compiler created a payment claim' }
if ($data.activation_policy.private_ip_doctrine_exposed -ne $false) { throw 'Private IP doctrine exposure flag is unsafe' }

$record = [ordered]@{
    schema = 'BEC-PRIME/SILO-PORTFOLIO-VERIFIER/v1'
    status = 'PASS'
    verified_at = (Get-Date).ToUniversalTime().ToString('o')
    wedge_count = [int]$data.wedge_count
    compiler = $compiler.Replace($RepoRoot,'').TrimStart('\')
    catalog = $catalog.Replace($RepoRoot,'').TrimStart('\')
    surface = $surface.Replace($RepoRoot,'').TrimStart('\')
    gates = [ordered]@{
        approval_required = $true
        checkout_available = $false
        payment_claimed = $false
        private_ip_exposed = $false
        external_actions_allowed = $false
    }
}

$verifyPath = Join-Path $RepoRoot 'PROOF-SILO-PORTFOLIO-VERIFICATION.json'
$record | ConvertTo-Json -Depth 10 | Set-Content $verifyPath -Encoding utf8
Write-Host 'SILO PORTFOLIO VERIFICATION: PASS' -ForegroundColor Green
Write-Host "Wedges compiled: $($data.wedge_count)"
Write-Host "Proof: $verifyPath"
