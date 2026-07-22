# orchestrator/Run-RevenueLoop.ps1
$ErrorActionPreference = "Continue"
$ROOT = "C:\BrownEyeCortex\DreamLedger"
$LOG = "D:\DreamLedgerLogs\run-log.txt"
Import-Module "$ROOT\modules\TenantContext.psm1" -Force
Set-TenantContext -TenantId "system"
function Log($msg) { $line = "$(Get-Date -Format o) :: $msg"; Add-Content -Path $LOG -Value $line; Write-Host $line }
Log "=== REVENUE LOOP START ==="
& "$ROOT\signal-engine\IngestSignals.ps1" 2>&1 | Out-String | Log
& "$ROOT\offer-factory\GenerateOffers.ps1" 2>&1 | Out-String | Log
& "$ROOT\offer-factory\SyncOffers.ps1" 2>&1 | Out-String | Log
& "$ROOT\governor\Governor.ps1" 2>&1 | Out-String | Log
& "$ROOT\governor\Allocator.ps1" 2>&1 | Out-String | Log
& "$ROOT\marketplace\GenerateSEO.ps1" 2>&1 | Out-String | Log
& "$ROOT\marketplace\Deploy.ps1" 2>&1 | Out-String | Log
& "$ROOT\telemetry\ProcessEvents.ps1" 2>&1 | Out-String | Log
& "$ROOT\mesh\GenerateMesh.ps1" 2>&1 | Out-String | Log
Log "=== REVENUE LOOP COMPLETE ==="
