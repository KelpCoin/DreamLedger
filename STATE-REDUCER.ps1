#Requires -Version 5.1
Set-StrictMode -Off
$ErrorActionPreference = 'Continue'
$ROOT = 'C:\BrownEyeCortex'

$registry = @()
if (Test-Path "$ROOT\data\registry.json") {
    $raw = Get-Content "$ROOT\data\registry.json" -Raw -ErrorAction SilentlyContinue
    if ($raw) { $registry = @($raw | ConvertFrom-Json -ErrorAction SilentlyContinue) }
}

$events = @()
if (Test-Path "$ROOT\ledger\event.log") {
    $events = Get-Content "$ROOT\ledger\event.log" -Encoding UTF8 |
        Where-Object { $_ -match '\S' } |
        ForEach-Object { try { $_ | ConvertFrom-Json } catch { $null } } |
        Where-Object { $_ }
}

$saleEvents     = @($events | Where-Object { $_.event_type -eq 'sale' -and -not $_.flags.test })
$totalSales     = $saleEvents.Count
$totalRevCents  = ($saleEvents | ForEach-Object { if ($_.metrics.amount_nzd_cents) { [int]$_.metrics.amount_nzd_cents } else { 0 } } | Measure-Object -Sum).Sum

$intelligenceActive = ($events | Where-Object { $_.flags.ignite -eq $true }).Count -gt 0
$marketPhase = if ($totalSales -eq 0) { 'seeding' }
               elseif ($totalSales -lt 5) { 'early' }
               elseif ($totalSales -lt 20) { 'active' }
               else { 'optimizing' }

# Per-SKU metrics
$skuSales = @{}
foreach ($e in $saleEvents) {
    $sid = [string]$e.entity.sku_id
    if (-not $skuSales.ContainsKey($sid)) { $skuSales[$sid] = @{ sales = 0; revenue = 0 } }
    $skuSales[$sid].sales++
    if ($e.metrics.amount_nzd_cents) { $skuSales[$sid].revenue += [double]$e.metrics.amount_nzd_cents }
}

$nowTs  = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$perSku = @(foreach ($sku in $registry) {
    $sid = [string]$sku.id
    $m   = if ($skuSales.ContainsKey($sid)) { $skuSales[$sid] } else { @{ sales = 0; revenue = 0 } }
    $dom = -1
    if ($sku.PSObject.Properties['listed_utc'] -and $sku.listed_utc) {
        try {
            $listedTs = [DateTimeOffset]::Parse([string]$sku.listed_utc).ToUnixTimeSeconds()
            $dom = [Math]::Round(($nowTs - $listedTs) / 86400.0, 1)
        } catch { }
    }
    [PSCustomObject]@{
        sku_id        = $sid
        name          = [string]$sku.name
        price_nzd     = [int]$sku.price_nzd
        sales         = $m.sales
        revenue_cents = $m.revenue
        sold          = ($m.sales -gt 0)
        days_on_market = $dom
    }
})

$sellThrough = if ($registry.Count -gt 0) {
    [Math]::Round(@($perSku | Where-Object { $_.sold }).Count / [double]$registry.Count, 4)
} else { 0.0 }

$lastSaleTs = $null
$lastSale   = $saleEvents | Select-Object -Last 1
if ($null -ne $lastSale) { $lastSaleTs = [string]$lastSale.timestamp_utc }


$state | ConvertTo-Json -Depth 10 | Set-Content "$ROOT\data\state.json" -Encoding UTF8
$revenueNZD = [Math]::Round($totalRevCents/100, 2)
Write-Host "STATE-REDUCER: sales=$totalSales revenue=NZD$revenueNZD skus=$($registry.Count) phase=$marketPhase"
