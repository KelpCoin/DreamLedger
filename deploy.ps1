# C:\BrownEyeCortex\deploy.ps1
$ErrorActionPreference = "Stop"
$BASE = "C:\BrownEyeCortex"
Import-Module "$BASE\modules\DreamLedger.Kernel.psm1" -Force
Import-Module "$BASE\modules\DreamLedger.Diagnostics.psm1" -Force
Import-Module "$BASE\modules\DreamLedger.RevenueEngine.psm1" -Force
Write-Host "Modules loaded OK"
Start-Process powershell -ArgumentList "-ExecutionPolicy Bypass -WindowStyle Hidden -File `"$BASE\CORTEX-MASTER-DISPATCH.ps1`"" -WindowStyle Hidden
Write-Host "Dispatcher launched"
Write-Host "DEPLOY COMPLETE"
