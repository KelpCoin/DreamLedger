#requires -Version 5.1
[CmdletBinding()]
param(
    [string]$RepoRoot = "$PSScriptRoot\.."
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$RepoRoot = [IO.Path]::GetFullPath($RepoRoot)
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
    $entry = $null
    $registryKey = $null
    foreach ($key in @([string]$offer.offer_id, [string]$offer.product_id, [string]$offer.product_sku)) {
        if ([string]::IsNullOrWhiteSpace($key)) { continue }
        $property = $registry.entries.PSObject.Properties[$key]
        if ($null -ne $property) {
            $entry = $property.Value
            $registryKey = $key
            break
        }
    }
    $url = [string]$offer.payment_link_url
    $hasConfiguredLiveLink = ($offer.payment_link_status -eq 'ACTIVE_LIVEMODE' -and
        $url -match '^https://buy\.stripe\.com/[A-Za-z0-9]+$' -and
        [string]$offer.fulfillment_route -notmatch '^HOLD_')
    $heldRoute = (-not $hasConfiguredLiveLink -and
        ($offer.payment_link_status -ne 'ACTIVE_LIVEMODE' -or [string]::IsNullOrWhiteSpace($url)) -and
        [string]$offer.fulfillment_route -match '^HOLD_')
    $ready = ($null -ne $entry -and [bool]$entry.ready)
    $operatorRequired = ($null -eq $entry -or [bool]$entry.operator_required)
    $coherent = $false
    if ($hasConfiguredLiveLink) {
        $coherent = ($null -ne $entry -and $ready -and -not $operatorRequired)
    } elseif ($heldRoute) {
        $coherent = ($null -ne $entry -and -not $ready -and $operatorRequired)
    }
    $results += [pscustomobject]@{
        offer_id = [string]$offer.offer_id
        product_id = [string]$offer.product_id
        sku = [string]$offer.product_sku
        registry_key = $registryKey
        ready = $ready
        operator_required = $operatorRequired
        configured_live_link = $hasConfiguredLiveLink
        held_route = $heldRoute
        coherent = $coherent
        commercial_state = if ($hasConfiguredLiveLink -and $coherent) { 'SELLABLE_CONFIGURED' } elseif ($heldRoute -and $coherent) { 'HELD_SAFELY' } else { 'CONFLICT' }
        fulfillment_route = [string]$offer.fulfillment_route
    }
}
$bad = @($results | Where-Object { -not $_.coherent })
$sellable = @($results | Where-Object { $_.commercial_state -eq 'SELLABLE_CONFIGURED' }).Count
$held = @($results | Where-Object { $_.commercial_state -eq 'HELD_SAFELY' }).Count
$proof = [ordered]@{
    schema = 'dreamledger/public-offer-fulfillment/v2'
    timestamp = (Get-Date).ToUniversalTime().ToString('o')
    policy = 'Active checkout requires ready=true and operator_required=false. Unverified offers must retain a HOLD route, ready=false, and operator_required=true.'
    approved_offer_count = @($results).Count
    configured_sellable_count = $sellable
    safely_held_count = $held
    results = $results
    result = if ($bad.Count -eq 0) { 'PASS' } else { 'FAIL' }
    proof_path = $proofPath
}
$proof | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $proofPath -Encoding UTF8
$proof | ConvertTo-Json -Depth 10
if ($bad.Count -gt 0) { exit 1 }
exit 0
