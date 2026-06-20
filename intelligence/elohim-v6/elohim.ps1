#Requires -Version 5.1
$ROOT       = 'C:\BrownEyeCortex'
$METRICS    = "$ROOT\intelligence\gauntlet-v6\metrics_report.json"
$STATE_FILE = "$ROOT\data\state.json"

if (-not (Test-Path $METRICS)) { Write-Host 'Elohim: no metrics. Run Gauntlet first.'; exit 1 }

$state   = Get-Content $STATE_FILE -Raw | ConvertFrom-Json -ErrorAction Stop
$metrics = Get-Content $METRICS    -Raw | ConvertFrom-Json -ErrorAction Stop
$skus    = @($metrics.all_sku_metrics)

# Safety gate: require at least one real sale before mutation
if ($state.sales_count -lt 1) {
    Write-Host 'Elohim: no real sales signal. Proposals blocked.'
    @{ generated_utc = [DateTimeOffset]::UtcNow.ToString('o'); proposals = @() } |
        ConvertTo-Json | Set-Content "$ROOT\intelligence\elohim-v6\proposals.json" -Encoding UTF8
    exit 0
}

if ([string]$state.intelligence_layer -ne 'active') {
    Write-Host 'Elohim: intelligence layer dormant. No proposals.'
    @{ generated_utc = [DateTimeOffset]::UtcNow.ToString('o'); proposals = @() } |
        ConvertTo-Json | Set-Content "$ROOT\intelligence\elohim-v6\proposals.json" -Encoding UTF8
    exit 0
}

$proposals = [System.Collections.Generic.List[PSCustomObject]]::new()

# Rule 1: Price down stuck/stale
foreach ($sku in @($skus | Where-Object { $_.velocity -in @('stuck','stale') })) {
    $factor   = if ($sku.velocity -eq 'stuck') { 0.88 } else { 0.92 }
    $proposed = [Math]::Max(2000, [int]([int]$sku.price_nzd_cents * $factor))
    $proposals.Add([PSCustomObject]@{
        id             = 'prop-' + [DateTimeOffset]::UtcNow.ToUnixTimeSeconds() + '-' + (Get-Random -Maximum 9999)
        type           = 'price_down'
        sku_id         = [string]$sku.sku_id
        sku_name       = [string]$sku.name
        current_cents  = [int]$sku.price_nzd_cents
        proposed_cents = $proposed
        change_pct     = [Math]::Round(($proposed - [int]$sku.price_nzd_cents) / [int]$sku.price_nzd_cents * 100, 1)
        confidence     = if ($sku.velocity -eq 'stuck') { 0.85 } else { 0.65 }
        rationale      = "velocity=$($sku.velocity) dom=$($sku.days_on_market)d"
        generated_utc  = [DateTimeOffset]::UtcNow.ToString('o')
    })
}

# Rule 2: Price up fast movers
foreach ($sku in @($skus | Where-Object { $_.velocity -eq 'fast' })) {
    $proposed = [int]([int]$sku.price_nzd_cents * 1.10)
    $proposals.Add([PSCustomObject]@{
        id             = 'prop-' + [DateTimeOffset]::UtcNow.ToUnixTimeSeconds() + '-' + (Get-Random -Maximum 9999)
        type           = 'price_up'
        sku_id         = [string]$sku.sku_id
        sku_name       = [string]$sku.name
        current_cents  = [int]$sku.price_nzd_cents
        proposed_cents = $proposed
        change_pct     = 10.0
        confidence     = 0.55
        rationale      = "fast sell ($($sku.days_on_market)d)  price elasticity test"
        generated_utc  = [DateTimeOffset]::UtcNow.ToString('o')
    })
}

# Rule 3: Bundle two stuck unsold decks
$unsoldStuck = @($skus | Where-Object { -not $_.sold -and $_.velocity -in @('stuck','stale') } |
    Sort-Object urgency_score -Descending)
if ($unsoldStuck.Count -ge 2) {
    $a = $unsoldStuck[0]; $b = $unsoldStuck[1]
    $bundleCents = [int](([int]$a.price_nzd_cents + [int]$b.price_nzd_cents) * 0.82)
    $proposals.Add([PSCustomObject]@{
        id             = 'prop-bundle-' + [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
        type           = 'bundle'
        sku_ids        = @([string]$a.sku_id, [string]$b.sku_id)
        bundle_name    = "Commander Bundle: $($a.name) + $($b.name)"
        bundle_cents   = $bundleCents
        discount_pct   = 18
        confidence     = 0.70
        rationale      = "Both unsold $($a.days_on_market)d + $($b.days_on_market)d"
        generated_utc  = [DateTimeOffset]::UtcNow.ToString('o')
    })
}

$output = [ordered]@{
    generated_utc   = [DateTimeOffset]::UtcNow.ToString('o')
    proposals_count = $proposals.Count
    proposals       = $proposals.ToArray()
}
$output | ConvertTo-Json -Depth 10 | Set-Content "$ROOT\intelligence\elohim-v6\proposals.json" -Encoding UTF8
Write-Host "Elohim V6: $($proposals.Count) proposal(s) generated."