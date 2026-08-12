[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

$ProofDir = Join-Path $Root 'RUN-PROOFS'
New-Item -ItemType Directory -Force -Path $ProofDir | Out-Null

Write-Host '=== BEC-PRIME FULL COMPILER ===' -ForegroundColor Cyan

if (Test-Path (Join-Path $Root 'package.json')) {
    Write-Host '[0/4] Installing declared Node dependencies...' -ForegroundColor Yellow
    npm install --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { throw 'npm install failed.' }
}

Write-Host '[1/4] Compiling the existing DreamLedger surface...' -ForegroundColor Yellow
npm run compile
if ($LASTEXITCODE -ne 0) { throw 'DreamLedger npm compile failed.' }

$steps = @(
    @{ Name = 'EconomicTrees'; Command = { node compiler/Compile-EconomicTrees.js } },
    @{ Name = 'SiloPortfolio'; Command = { node compiler/SiloPortfolioCompiler.js } }
)

foreach ($step in $steps) {
    Write-Host (('[2/4] {0} compiling...' -f $step.Name)) -ForegroundColor Yellow
    & $step.Command
    if ($LASTEXITCODE -ne 0) { throw ('Compiler failed: ' + $step.Name) }
}

if (Test-Path (Join-Path $PSScriptRoot 'Verify-Offers.ps1')) {
    & (Join-Path $PSScriptRoot 'Verify-Offers.ps1')
    if ($LASTEXITCODE -ne 0) { throw 'Offer verification failed.' }
}

$proof = [ordered]@{
    schema = 'BEC-PRIME/FULL-COMPILATION/v3'
    status = 'PASS'
    compiled_at = (Get-Date).ToUniversalTime().ToString('o')
    compiler = 'Compile-All.ps1'
    inputs = @(
        'package.json',
        'BEC-PRIME/economics/ECONOMIC-TREES.json',
        'BEC-PRIME/economics/IP-ECONOMIC-COMPILATION.json',
        'BEC-PRIME/PROOF-2026-08-11-MONETIZATION-WEDGE-PORTFOLIO.json'
    )
    outputs = @(
        'catalog/compiled',
        'compiled/website',
        'compiled/website/economics/ip-manifest.json',
        'PROOF-ECONOMIC-TREE-COMPILATION.json',
        'PROOF-SILO-PORTFOLIO-COMPILATION.json'
    )
    guarantees = @{
        existing_dreamledger_compile = $true
        economic_tree_compile = $true
        ip_contract_compile = $true
        silo_portfolio_compile = $true
        payment_claims_created = $false
        external_actions_created = $false
    }
}
$stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$proofPath = Join-Path $ProofDir ('FULL-COMPILATION-' + $stamp + '.json')
$proof | ConvertTo-Json -Depth 10 | Set-Content -Path $proofPath -Encoding UTF8
Write-Host ('FULL COMPILATION PASS: ' + $proofPath) -ForegroundColor Green
