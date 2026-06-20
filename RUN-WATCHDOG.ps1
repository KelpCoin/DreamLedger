while ($true) {
    try {
        $p = Get-Process powershell -ErrorAction SilentlyContinue
        if (-not $p) {
            Start-Process powershell -ArgumentList "-File C:\BrownEyeCortex\RUN-WATCHER.ps1"
        }
    } catch {}
    Start-Sleep -Seconds 30
}
