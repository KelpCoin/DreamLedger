[CmdletBinding()]
param(
    [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path,
    [switch]$SkipSmoke
)

$ErrorActionPreference = 'Stop'
Set-Location $RepoRoot

$proofDir = Join-Path $RepoRoot 'data\proofs'
New-Item -ItemType Directory -Force -Path $proofDir | Out-Null
$proofPath = Join-Path $proofDir 'FIRST-REVENUE-ACTIVATION-GATE.json'
$productPath = Join-Path $RepoRoot 'catalog\products\COMMANDER-DECK-DIAGNOSTIC-001.json'
$offerPath = Join-Path $RepoRoot 'catalog\offers\offers.json'
$registry = Join-Path $RepoRoot 'scripts\Verify-Registry.ps1'

function Invoke-Gate([string]$Name, [scriptblock]$Action) {
    Write-Host "[GATE] $Name"
    & $Action
    if ($LASTEXITCODE -ne 0) { throw "Gate failed: $Name (exit $LASTEXITCODE)" }
    Write-Host "[PASS] $Name"
}

$gates = @()

if (-not $SkipSmoke) {
    Invoke-Gate 'Revenue ledger smoke' { npm run smoke:revenue-ledger }
    $gates += 'smoke:revenue-ledger'
}

Invoke-Gate 'Gauntlet' { npm run gauntlet }
$gates += 'gauntlet'

Invoke-Gate 'Registry boundary' { powershell -NoProfile -ExecutionPolicy Bypass -File $registry }
$gates += 'Verify-Registry.ps1'

if (-not (Test-Path $productPath)) { throw "Missing activation product: $productPath" }
if (-not (Test-Path $offerPath)) { throw "Missing compiled offer catalog: $offerPath" }

$product = Get-Content $productPath -Raw | ConvertFrom-Json
if ($product.id -ne 'COMMANDER-DECK-DIAGNOSTIC-001') { throw 'Unexpected activation SKU' }
if ($product.price -ne 1500 -or $product.currency -ne 'nzd') { throw 'Activation SKU price/currency changed; refusing to activate' }

$product.commercial_truth.approval_required = $false
$product.commercial_truth.activation_gate = 'FIRST_REVENUE_GATES_PASS'
$product.commercial_truth.activation_timestamp = (Get-Date).ToUniversalTime().ToString('o')
$product.evidence.status = 'awaiting_first_payment'

$backup = "$productPath.pre-activation.json"
Copy-Item $productPath $backup -Force
$product | ConvertTo-Json -Depth 20 | Set-Content $productPath -Encoding utf8

$proof = [ordered]@{
    type = 'dreamledger-first-revenue-activation-gate'
    status = 'PASS'
    sku = $product.id
    price_nzd = [math]::Round($product.price / 100, 2)
    gates = $gates
    activation_rule = 'No activation occurs unless all required verification gates exit successfully.'
    payment_proof_status = 'AWAITING_FIRST_PAYMENT'
    product_path = 'catalog/products/COMMANDER-DECK-DIAGNOSTIC-001.json'
    backup_path = 'catalog/products/COMMANDER-DECK-DIAGNOSTIC-001.json.pre-activation.json'
    activated_at_utc = $product.commercial_truth.activation_timestamp
}
$proof | ConvertTo-Json -Depth 10 | Set-Content $proofPath -Encoding utf8

Write-Host ''
Write-Host 'FIRST REVENUE ACTIVATION: PASS' -ForegroundColor Green
Write-Host 'Commander Deck Diagnostic is now checkout-eligible.'
Write-Host 'This script does not claim revenue. Revenue remains unproven until a signed Stripe webhook creates FIRST_PAYMENT_PROOF.json.'
Write-Host "Proof: $proofPath"
