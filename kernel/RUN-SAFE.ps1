param([string]$script)
$ROOT = 'C:\BrownEyeCortex'
$lock = "$ROOT\ledger\ledger.lock"
if (-not (Test-Path $lock)) {
    Write-Warning "Ledger lock missing  creating it."
    New-Item -ItemType File -Force -Path $lock | Out-Null
}
$p = Start-Process powershell.exe -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$script`"" -Wait -PassThru
if ($p.ExitCode -ne 0) {
    Write-Host "PIPELINE FAILURE: $script (exit $($p.ExitCode))" -ForegroundColor Red
    exit $p.ExitCode
}