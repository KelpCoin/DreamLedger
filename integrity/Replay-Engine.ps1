#Requires -Version 5.1
$ROOT   = 'C:\BrownEyeCortex'
$LOG    = "$ROOT\ledger\event.log"
$OUTPUT = "$ROOT\data\replay_state.json"

if (-not (Test-Path $LOG)) { Write-Warning 'Event log not found.'; exit 1 }

$events = @(Get-Content $LOG -Encoding UTF8 | Where-Object { $_ -match '\S' } | ForEach-Object {
    try { $_ | ConvertFrom-Json -ErrorAction Stop } catch { }
} | Where-Object { $null -ne $_ })

$saleEvents = @($events | Where-Object { $_.event_type -eq 'sale' -and -not $_.flags.test })
$revenueSum = 0
foreach ($e in $saleEvents) {
    if ($e.PSObject.Properties['metrics']) { $revenueSum += [int]$e.metrics.amount_nzd_cents }
}

$replay = [ordered]@{
    replayed_utc     = [DateTimeOffset]::UtcNow.ToString('o')
    total_events     = $events.Count
    sale_events      = $saleEvents.Count
    inventory_events = @($events | Where-Object { $_.event_type -eq 'inventory' }).Count
    system_events    = @($events | Where-Object { $_.event_type -eq 'system' }).Count
    total_revenue_nzd = [Math]::Round($revenueSum / 100.0, 2)
    first_event_ts   = if ($events.Count -gt 0) { $events[0].timestamp_utc } else { $null }
    last_event_ts    = if ($events.Count -gt 0) { $events[-1].timestamp_utc } else { $null }
}
$replay | ConvertTo-Json -Depth 5 | Set-Content $OUTPUT -Encoding UTF8
Write-Host "REPLAY COMPLETE: $($events.Count) events  NZD $$([Math]::Round($revenueSum/100,2))"