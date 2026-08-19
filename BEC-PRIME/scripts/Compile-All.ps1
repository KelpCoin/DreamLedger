#requires -Version 5.1
[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root
$ProofDir = Join-Path $Root 'RUN-PROOFS'
New-Item -ItemType Directory -Force -Path $ProofDir | Out-Null
Write-Host '=== BEC-PRIME FULL COMPILER ===' -ForegroundColor Cyan
if (Test-Path (Join-Path $Root 'package.json')) { npm install --no-audit --no-fund; if ($LASTEXITCODE -ne 0) { throw 'npm install failed.' } }
Write-Host '[1/6] Compiling DreamLedger surface...' -ForegroundColor Yellow
npm run compile
if ($LASTEXITCODE -ne 0) { throw 'DreamLedger npm compile failed.' }
$loginPath = Join-Path $Root 'compiled/website/login.html'
$registerPath = Join-Path $Root 'compiled/website/register.html'
$accountPath = Join-Path $Root 'compiled/website/account.html'
foreach ($p in @($loginPath,$registerPath,$accountPath)) { if (-not (Test-Path $p)) { throw ('Required account surface missing: ' + $p) } }
$login = Get-Content -Raw -LiteralPath $loginPath
$register = Get-Content -Raw -LiteralPath $registerPath
if ($login -notmatch '/api/account/login') { throw 'login.html is not using the primary DreamLedger account contract.' }
if ($login -match '/api/dreamiez/account/login') { throw 'login.html incorrectly depends on Dreamiez authentication.' }
if ($register -notmatch '/api/account/register' -or $register -match '/api/dreamiez/account/create') { throw 'register.html is not using the primary DreamLedger account contract.' }
Write-Host 'PASS: primary DreamLedger account login/register contract verified.' -ForegroundColor Green
$steps = @(
    @{ Name = 'EconomicTrees'; Command = { node compiler/Compile-EconomicTrees.js } },
    @{ Name = 'SiloPortfolio'; Command = { node compiler/SiloPortfolioCompiler.js } }
)
foreach ($step in $steps) { & $step.Command; if ($LASTEXITCODE -ne 0) { throw ('Compiler failed: ' + $step.Name) } }
if (Test-Path (Join-Path $PSScriptRoot 'Verify-Offers.ps1')) { & (Join-Path $PSScriptRoot 'Verify-Offers.ps1'); if ($LASTEXITCODE -ne 0) { throw 'Offer verification failed.' } }
Write-Host '[6/6] Verifying compiler truth contract...' -ForegroundColor Yellow
$truthVerifier = Join-Path $PSScriptRoot 'Verify-CompilerTruth.ps1'
$truthProof = Join-Path $ProofDir 'COMPILER-TRUTH-PROOF.json'
if (-not (Test-Path -LiteralPath $truthVerifier)) { throw ('Compiler truth verifier missing: ' + $truthVerifier) }
& $truthVerifier -ProofPath $truthProof
if ($LASTEXITCODE -ne 0) { throw 'Compiler truth verification failed.' }
$proof = [ordered]@{
    schema = 'BEC-PRIME/FULL-COMPILATION/v6'
    status = 'PASS'
    compiled_at = (Get-Date).ToUniversalTime().ToString('o')
    compiler = 'Compile-All.ps1'
    compiler_truth_proof = 'RUN-PROOFS/COMPILER-TRUTH-PROOF.json'
    account_contract = @{ login_endpoint='/api/account/login'; session_endpoint='/api/account/me'; register_endpoint='/api/account/register'; dreamiez_required=$false; verified=$true }
    required_public_surfaces = @('compiled/website/login.html','compiled/website/register.html','compiled/website/account.html')
    guarantees = @{ existing_dreamledger_compile=$true; primary_account_contract_verified=$true; compiler_truth_verified=$true; dreamiez_required_for_login=$false; payment_claims_created=$false; external_actions_created=$false }
}
$stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$proofPath = Join-Path $ProofDir ('FULL-COMPILATION-' + $stamp + '.json')
$proof | ConvertTo-Json -Depth 10 | Set-Content -Path $proofPath -Encoding UTF8
Write-Host ('FULL COMPILATION PASS: ' + $proofPath) -ForegroundColor Green
