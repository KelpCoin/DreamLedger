Set-StrictMode -Version 2.0
$ErrorActionPreference = "Stop"

$root = "C:\BrownEyeCortex\mtg-data-furnace"
Set-Location $root

while ($true) {
    try {
        Write-Host "[BOOT] Starting MTG Furnace..."
        node worker.mjs
        Write-Host "[WARN] Bot exited, restarting in 5 seconds..."
        Start-Sleep -Seconds 5
    }
    catch {
        Write-Host "[ERROR] Crash detected, restarting..."
        Start-Sleep -Seconds 5
    }
}
