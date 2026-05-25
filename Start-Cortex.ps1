# Start-Cortex.ps1
param($Root = "C:\BrownEyeCortex")
Write-Host "Bootstrapping Cortex..." -ForegroundColor Cyan
$ledger = "$Root\ledger\events.jsonl"
if (Test-Path $ledger) {
    $bad = Get-Content $ledger | ForEach-Object { try { $_ | ConvertFrom-Json } catch { $_ } } | Where-Object { $_ -isnot [PSCustomObject] }
    if ($bad) { Write-Warning "Corrupt lines found in ledger"; exit 1 }
}
& "$Root\runtime\http_bridge.ps1"