[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

$ProofDir = Join-Path $Root 'RUN-PROOFS'
New-Item -ItemType Directory -Force -Path $ProofDir | Out-Null

Write-Host '=== BEC-PRIME FULL COMPILER ===' -ForegroundColor Cyan

$steps = @(
    @{ Name = 'Offers'; Command = { node compiler/OfferCompiler.js } },
    @{ Name = 'EconomicTrees'; Command = { node compiler/Compile-EconomicTrees.js } },
    @{ Name = 'SiloPortfolio'; Command = { node compiler/SiloPortfolioCompiler.js } }
)

foreach ($step in $steps) {
    Write-Host (('[{0}] compiling...' -f $step.Name)) -ForegroundColor Yellow
    & $step.Command
    if ($LASTEXITCODE -ne 0) { throw ('Compiler failed: ' + $step.Name) }
}

if (Test-Path (Join-Path $PSScriptRoot 'Verify-Offers.ps1')) {
    & (Join-Path $PSScriptRoot 'Verify-Offers.ps1')
    if ($LASTEXITCODE -ne 0) { throw 'Offer verification failed.' }
}

$proof = [ordered]@{
    schema = 'BEC-PRIME/FULL-COMPILATION/v1'
    status = 'PASS'
    compiled_at = (Get-Date).ToUniversalTime().ToString('o')
    compiler = 'Compile-All.ps1'
    outputs = @(
        'catalog/compiled',
        'compiled/website',
        'PROOF-ECONOMIC-TREE-COMPILATION.json',
        'PROOF-SILO-PORTFOLIO-COMPILATION.json'
    )
}
$stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$proofPath = Join-Path $ProofDir ('FULL-COMPILATION-' + $stamp + '.json')
$proof | ConvertTo-Json -Depth 10 | Set-Content -Path $proofPath -Encoding UTF8
Write-Host ('FULL COMPILATION PASS: ' + $proofPath) -ForegroundColor Green
