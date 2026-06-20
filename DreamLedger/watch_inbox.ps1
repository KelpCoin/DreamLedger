while ($true) {
    try {
        powershell -ExecutionPolicy Bypass -File "C:\BrownEyeCortex\DreamLedger\merge_registry.ps1"
    } catch {}
    Start-Sleep -Seconds 30
}
