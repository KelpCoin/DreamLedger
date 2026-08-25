#requires -Version 5.1
[CmdletBinding()]
param(
    [string]$RepoRoot = "$PSScriptRoot\.."
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$registryPath = Join-Path $RepoRoot 'fulfillment\PRODUCT-FULFILLMENT-REGISTRY.json'
$approvedPath = Join-Path $RepoRoot 'catalog\offers\approved.json'
$proofDir = Join-Path $RepoRoot 'PROOF'
New-Item -ItemType Directory -Force -Path $proofDir | Out-Null
$ts = Get-Date -Format 'yyyyMMdd-HHmmss'
$proofPath = Join-Path $proofDir "PUBLIC-OFFER-FULFILLMENT-$ts.json"
$registry = Get-Content -Raw -LiteralPath $registryPath | ConvertFrom-Json
$approved = Get-Content -Raw -LiteralPath $approvedPath | ConvertFrom-Json
$results = @()
foreach ($offer in @($approved.approved)) {
    $sku = [string]$offer.product_sku
    $entry = $registry.entries.$sku
    $results += [pscustomobject]@{
        offer_id = [string]$offer.offer_id
        sku = $sku
        ready = [bool]$entry.ready
        operator_required = [bool]$entry.operator_required
        zero_human = (([bool]$entry.ready) -and (-not [bool]$entry.operator_required))
        fulfillment_route = [string]$offer.fulfillment_route
    }
}
$bad = @($results | Where-Object { -not $_.zero_human })
$proof = [ordered]@{
    timestamp = (Get-Date).ToString('o')
    policy = 'Every publicly approved offer must have ready=true and operator_required=false.'
    approved_offer_count = @($results).Count
    results = $results
    result = if ($bad.Count -eq 0) { 'PASS' } else { 'FAIL' }
}
$proof | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $proofPath -Encoding UTF8
$proof | ConvertTo-Json -Depth 10
if ($bad.Count -gt 0) { exit 1 }
exit 0
