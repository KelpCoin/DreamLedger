$ErrorActionPreference = "SilentlyContinue"

$root = "C:\BrownEyeCortex"
$logDir = "$root\diagnostics"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$log = "$logDir\probe_$stamp.log"

function L($m){ Add-Content $log $m }

L "=== CLEAN PROBE START ==="

# SYSTEM
$cpu = Get-CimInstance Win32_Processor | Select-Object -Expand LoadPercentage
$ram = Get-CimInstance Win32_OperatingSystem
$total = [math]::Round($ram.TotalVisibleMemorySize/1MB,2)
$free = [math]::Round($ram.FreePhysicalMemory/1MB,2)

L "CPU:$cpu RAM_TOTAL:$total RAM_FREE:$free"

# DISK
$disk = Get-PSDrive C
L "DISK_USED:$([math]::Round($disk.Used/1GB,2)) DISK_FREE:$([math]::Round($disk.Free/1GB,2))"

# FRONTEND
try {
    $r = Invoke-WebRequest "https://dreamledger.org" -UseBasicParsing
    L "FRONTEND_STATUS_CODE:$($r.StatusCode)"
} catch {
    L "FRONTEND_CHECK:FAIL"
}

# LEDGER
$ledgerPath = "$root\_dreamledger\events\event_log.jsonl"
if (Test-Path $ledgerPath) {
    $count = (Get-Content $ledgerPath).Count
    L "LEDGER_EXISTS:YES LEDGER_LINES:$count"
} else {
    L "LEDGER_EXISTS:NO"
}

L "=== END PROBE ==="

Write-Host "PROBE COMPLETE -> $log"
