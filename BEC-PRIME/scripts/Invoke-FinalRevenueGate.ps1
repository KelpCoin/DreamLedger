[CmdletBinding()]
param(
  [string]$RepoPath = (Split-Path -Parent (Split-Path -Parent $PSScriptRoot))
)
Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::ASCII
$fail = $false

try {
  $repo = (Resolve-Path -LiteralPath $RepoPath).Path
} catch {
  Write-Output 'FAIL: repository path cannot be resolved'
  exit 1
}
$bec = Join-Path $repo 'BEC-PRIME'
if (-not (Test-Path -LiteralPath $bec -PathType Container)) {
  Write-Output 'FAIL: BEC-PRIME directory missing'
  exit 1
}

$productFile = Join-Path $bec 'catalog\products\COMMANDER-DECK-DIAGNOSTIC-001.json'
if (-not (Test-Path -LiteralPath $productFile -PathType Leaf)) {
  Write-Output 'FAIL: product file missing'
  $fail = $true
} else {
  try {
    $product = Get-Content -LiteralPath $productFile -Raw | ConvertFrom-Json
    if ($product.checkout.mode -ne 'payment') { Write-Output 'FAIL: checkout.mode != payment'; $fail = $true }
    if ($product.status -ne 'published') { Write-Output 'FAIL: status != published'; $fail = $true }
    if ($product.commercial_truth.approval_required -ne $false) { Write-Output 'FAIL: approval_required != false'; $fail = $true }
    if ([int]$product.inventory -lt 1) { Write-Output 'FAIL: inventory < 1'; $fail = $true }
  } catch {
    Write-Output ('FAIL: product contract parse/check error: ' + $_.Exception.Message)
    $fail = $true
  }
}

foreach ($script in @('verify-checkout-metadata-contract.js','verify-stripe-webhook-contract.js')) {
  $path = Join-Path $bec "scripts\$script"
  if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
    Write-Output "FAIL: missing $script"
    $fail = $true
    continue
  }
  & node $path
  if ($LASTEXITCODE -ne 0) {
    Write-Output "FAIL: $script exited non-zero"
    $fail = $true
  }
}

$surfaceGate = Join-Path $bec 'scripts\verify-public-surface.js'
if (Test-Path -LiteralPath $surfaceGate -PathType Leaf) {
  & node $surfaceGate
  if ($LASTEXITCODE -ne 0) {
    Write-Output 'FAIL: verify-public-surface.js exited non-zero'
    $fail = $true
  }
}

if ($fail) { Write-Output 'FINAL_REVENUE_GATE=FAIL'; exit 1 }
Write-Output 'FINAL_REVENUE_GATE=PASS'
exit 0
