#Requires -Version 5.1
$ROOT           = 'C:\BrownEyeCortex'
$PROPOSALS_FILE = "$ROOT\intelligence\elohim-v6\proposals.json"
$REG_PATH       = "$ROOT\data\registry.json"
$APPLIED_FILE   = "$ROOT\intelligence\supervisor-v6\applied.json"
$HELD_FILE      = "$ROOT\intelligence\supervisor-v6\held.json"
$HISTORY_FILE   = "$ROOT\intelligence\supervisor-v6\mutation_history.jsonl"

$MIN_PRICE_CENTS   = 2000
$MAX_PRICE_MULT    = 1.50
$MIN_CONF_UP       = 0.65
$COOLDOWN_DAYS     = 7

$proposals = @((Get-Content $PROPOSALS_FILE -Raw | ConvertFrom-Json).proposals)
$registry  = @(Get-Content $REG_PATH -Raw | ConvertFrom-Json -ErrorAction SilentlyContinue)
$nowTs     = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()

# Build cooldown map
$cooled = @{}
if (Test-Path $HISTORY_FILE) {
    $hist = @(Get-Content $HISTORY_FILE -Encoding UTF8 | Where-Object { $_ -match '\S' } | ForEach-Object {
        try { $_ | ConvertFrom-Json -ErrorAction Stop } catch { }
    } | Where-Object { $null -ne $_ })
    foreach ($h in $hist) {
        try {
            $appliedTs = [DateTimeOffset]::Parse([string]$h.applied_utc).ToUnixTimeSeconds()
            if (($nowTs - $appliedTs) / 86400.0 -lt $COOLDOWN_DAYS) { $cooled[[string]$h.sku_id] = $true }
        } catch { }
    }
}

$skuMap   = @{}; foreach ($s in $registry) { $skuMap[$s.id] = $s }
$approved = [System.Collections.Generic.List[PSCustomObject]]::new()
$held     = [System.Collections.Generic.List[PSCustomObject]]::new()

foreach ($p in $proposals) {
    $holdReason = $null
    $type       = [string]$p.type
    switch ($type) {
        'price_down' {
            $sid = [string]$p.sku_id
            if ($cooled[$sid])                                 { $holdReason = 'cooldown'; break }
            if (-not $skuMap.ContainsKey($sid))               { $holdReason = 'sku_not_found'; break }
            if ([int]$p.proposed_cents -lt $MIN_PRICE_CENTS)  { $holdReason = 'below_price_floor'; break }
        }
        'price_up' {
            $sid = [string]$p.sku_id
            if ($cooled[$sid])                                             { $holdReason = 'cooldown'; break }
            if (-not $skuMap.ContainsKey($sid))                           { $holdReason = 'sku_not_found'; break }
            if ([int]$p.proposed_cents -gt [int]$skuMap[$sid].price_nzd * $MAX_PRICE_MULT) { $holdReason = 'exceeds_max'; break }
            if ([double]$p.confidence -lt $MIN_CONF_UP)                   { $holdReason = 'low_confidence'; break }
            $holdReason = 'requires_human_review'
        }
        'bundle' {
            $bundleCents = [int]$p.bundle_cents
            if ($bundleCents -lt $MIN_PRICE_CENTS) { $holdReason = 'bundle_below_floor'; break }
        }
        default { $holdReason = 'unknown_type' }
    }

    $ann = $p | ConvertTo-Json -Depth 10 | ConvertFrom-Json
    $ann | Add-Member -MemberType NoteProperty -Name decision      -Value (if ($holdReason) { 'held' } else { 'approved' }) -Force
    $ann | Add-Member -MemberType NoteProperty -Name hold_reason   -Value $holdReason -Force
    $ann | Add-Member -MemberType NoteProperty -Name evaluated_utc -Value ([DateTimeOffset]::UtcNow.ToString('o')) -Force

    if ($holdReason) { $held.Add($ann) } else { $approved.Add($ann) }
}

# Apply approved mutations
$applied = 0
foreach ($m in $approved) {
    switch ([string]$m.type) {
        'price_down' {
            $sid = [string]$m.sku_id
            foreach ($sku in $registry) {
                if ($sku.id -eq $sid) {
                    $sku | Add-Member -MemberType NoteProperty -Name price_nzd -Value ([int]$m.proposed_cents) -Force
                    $applied++
                }
            }
        }
        'bundle' {
            $bSku = [PSCustomObject]@{
                id          = 'bundle-' + [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
                name        = [string]$m.bundle_name
                price_nzd   = [int]$m.bundle_cents
                description = "Bundle: $(@($m.sku_ids) -join ' + ')  18% off combined."
                type        = 'bundle'
                stripe_link = ''
                listed_utc  = [DateTimeOffset]::UtcNow.ToString('o')
                bundle_skus = @($m.sku_ids)
            }
            $registry += $bSku
            $applied++
        }
    }
    $histLine = [ordered]@{
        applied_utc  = [DateTimeOffset]::UtcNow.ToString('o')
        proposal_id  = [string]$m.id
        type         = [string]$m.type
        sku_id       = if ($m.PSObject.Properties['sku_id']) { [string]$m.sku_id } else { 'bundle' }
    } | ConvertTo-Json -Compress
    Add-Content $HISTORY_FILE $histLine -Encoding UTF8
}

$registry | ConvertTo-Json -Depth 10 | Set-Content $REG_PATH -Encoding UTF8
@{ approved = $approved.ToArray() } | ConvertTo-Json -Depth 10 | Set-Content $APPLIED_FILE -Encoding UTF8
@{ held     = $held.ToArray()     } | ConvertTo-Json -Depth 10 | Set-Content $HELD_FILE    -Encoding UTF8

Write-Host "Supervisor V6: approved=$($approved.Count) held=$($held.Count) applied=$applied"