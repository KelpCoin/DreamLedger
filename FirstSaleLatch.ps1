#Requires -Version 5.1
$ROOT     = 'C:\BrownEyeCortex'
$FLAG     = "$ROOT\signals\flags\FIRST_SALE_TRIGGERED.flag"
$LOG      = "$ROOT\ledger\event.log"

if (Test-Path $FLAG) { Write-Host 'FirstSaleLatch: already triggered.'; exit 0 }

$events = @()
if (Test-Path $LOG) {
    $events = @(Get-Content $LOG -Encoding UTF8 | Where-Object { $_ -match '\S' } | ForEach-Object {
        try { $_ | ConvertFrom-Json -ErrorAction Stop } catch { }
    } | Where-Object { $null -ne $_ })
}

$igniteEvents = @($events | Where-Object { $_.PSObject.Properties['flags'] -and $_.flags.ignite -eq $true })
if ($igniteEvents.Count -eq 0) { Write-Host 'FirstSaleLatch: no ignite events found.'; exit 0 }

"TRIGGERED $(Get-Date -Format 'o')" | Set-Content $FLAG -Encoding UTF8

try {
    $state = Get-Content "$ROOT\data\state.json" -Raw | ConvertFrom-Json -ErrorAction Stop
    $state | Add-Member -MemberType NoteProperty -Name intelligence_layer -Value 'active' -Force
    $state | ConvertTo-Json -Depth 10 | Set-Content "$ROOT\data\state.json" -Encoding UTF8
} catch { }

Write-Host 'FIRST SALE DETECTED  Intelligence layer is now ACTIVE.'
Write-Host 'Run RUN-INTELLIGENCE.ps1 to begin optimisation cycle.'