#Requires -Version 5.1
while ($true) {
    $watcher = Get-Process -Name powershell -ErrorAction SilentlyContinue |
        Where-Object { $_.MainWindowTitle -like '*WATCHER*' -or $_.CommandLine -like '*RUN-WATCHER*' }
    if (-not $watcher) {
        Write-Host "$(Get-Date -Format 'HH:mm:ss')  Watcher not running. Restarting..."
        Start-Process powershell.exe -ArgumentList '-ExecutionPolicy Bypass -File "C:\BrownEyeCortex\kernel\RUN-WATCHER.ps1"' -WindowStyle Hidden
    }
    Start-Sleep -Seconds 30
}