#Requires -Version 5.1
$ROOT = 'C:\BrownEyeCortex'
if (-not (Test-Path "$ROOT\data\state.json")) { Write-Host 'Gauntlet: no state.json'; exit 1 }

$state    = Get-Content "$ROOT\data\state.json" -Raw | ConvertFrom-Json -ErrorAction Stop
$registry = @(Get-Content "$ROOT\data\registry.json" -Raw | ConvertFrom-Json -ErrorAction SilentlyContinue)
$nowTs    = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()

$skuMetrics = @(foreach ($sku in $registry) {
    $sid    = [string]$sku.id
    $stSku  = $state.per_sku | Where-Object { $_.sku_id -eq $sid } | Select-Object -First 1
    $dom    = if ($null -ne $stSku) { [double]$stSku.days_on_market } else { 0 }
    $sales  = if ($null -ne $stSku) { [int]$stSku.sales } else { 0 }
    $sold   = ($sales -gt 0)

    $velocity = if ($sold -and $dom -le 3)   { 'fast'    }
                elseif ($sold -and $dom -le 10) { 'normal' }
                elseif ($sold)               { 'slow'   }
                elseif ($dom -le 7)          { 'new'    }
                elseif ($dom -le 14)         { 'active' }
                elseif ($dom -le 21)         { 'stale'  }
                else                         { 'stuck'  }

    $urgency = if ($sold) { 0.0 }
               elseif ($dom -gt 21) { 1.0 }
               elseif ($dom -gt 14) { 0.7 }
               elseif ($dom -gt 7)  { 0.4 }
               else                  { 0.1 }

    $recommendation = switch ($velocity) {
        'fast'   { 'price_up' }
        'stuck'  { 'price_down_aggressive' }
        'stale'  { 'price_down_mild' }
        default  { 'hold' }
    }

    [PSCustomObject]@{
        sku_id          = $sid
        name            = [string]$sku.name
        price_nzd_cents = [int]$sku.price_nzd
        price_nzd       = [Math]::Round([int]$sku.price_nzd / 100.0, 2)
        sales           = $sales
        sold            = $sold
        days_on_market  = $dom
        velocity        = $velocity
        urgency_score   = $urgency
        recommendation  = $recommendation
    }
})

$soldList   = @($skuMetrics | Where-Object { $_.sold })
$unsoldList = @($skuMetrics | Where-Object { -not $_.sold })
$stuckList  = @($skuMetrics | Where-Object { $_.velocity -eq 'stuck' })

$avgDays = if ($soldList.Count -gt 0) {
    [Math]::Round(($soldList | Measure-Object days_on_market -Average).Average, 1)
} else { $null }

$report = [ordered]@{
    generated_utc     = [DateTimeOffset]::UtcNow.ToString('o')
    market_phase      = [string]$state.market_phase
    total_skus        = $registry.Count
    sold_count        = $soldList.Count
    unsold_count      = $unsoldList.Count
    stuck_count       = $stuckList.Count
    sell_through_pct  = [Math]::Round([double]$state.sell_through_rate * 100, 1)
    total_revenue_nzd = [double]$state.revenue_nzd
    avg_days_to_sell  = $avgDays
    needs_attention   = @($unsoldList | Sort-Object urgency_score -Descending | Select-Object -First 5)
    all_sku_metrics   = $skuMetrics
}
$report | ConvertTo-Json -Depth 10 | Set-Content "$ROOT\intelligence\gauntlet-v6\metrics_report.json" -Encoding UTF8
Write-Host "Gauntlet V6: sell-through=$($report.sell_through_pct)% revenue=NZD$$($report.total_revenue_nzd) stuck=$($stuckList.Count)"