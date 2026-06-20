#Requires -Version 5.1
$ROOT = 'C:\BrownEyeCortex'
$registry = @()
if (Test-Path "$ROOT\data\registry.json") {
    $raw = Get-Content "$ROOT\data\registry.json" -Raw -ErrorAction SilentlyContinue
    if ($raw) { $registry = @($raw | ConvertFrom-Json -ErrorAction SilentlyContinue) }
}
if ($registry.Count -eq 0) { Write-Host 'Exposure: no SKUs.'; exit 0 }

$state = $null
if (Test-Path "$ROOT\data\state.json") {
    $state = Get-Content "$ROOT\data\state.json" -Raw | ConvertFrom-Json -ErrorAction SilentlyContinue
}

$ranked = foreach ($sku in $registry) {
    $skuState = if ($null -ne $state -and $state.PSObject.Properties['per_sku']) {
        $state.per_sku | Where-Object { $_.sku_id -eq $sku.id } | Select-Object -First 1
    } else { $null }

    $salesScore   = if ($null -ne $skuState) { [int]$skuState.sales * 3 } else { 0 }
    $priceScore   = [Math]::Round([int]$sku.price_nzd / 100.0 * 0.02, 4)
    $hasLink      = if ($sku.stripe_link -and $sku.stripe_link -ne '') { 1 } else { 0 }
    $domScore     = if ($null -ne $skuState -and [double]$skuState.days_on_market -gt 0) {
        [Math]::Min(0.5, [double]$skuState.days_on_market * 0.02)
    } else { 0 }

    $exposure = $salesScore + $priceScore + $hasLink + $domScore
    [PSCustomObject]@{
        sku_id         = [string]$sku.id
        name           = [string]$sku.name
        exposure_score = [Math]::Round($exposure, 4)
        has_link       = ($hasLink -eq 1)
    }
}

if ($ranked) {
    $ranked | Sort-Object exposure_score -Descending | ConvertTo-Json -Depth 5 | Set-Content "$ROOT\data\exposure_order.json" -Encoding UTF8
    Write-Host "Exposure: $($ranked.Count) SKUs ranked. Top: $($ranked[0].name)"
} else {
    Write-Host "Exposure: no valid SKU data to rank."
}
