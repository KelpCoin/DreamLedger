#Requires -Version 5.1
# Installs an idempotent Windows watchdog for the existing DreamLedger runtime.
$ErrorActionPreference='Stop'
$ScriptRoot='C:\BrownEyeCortex\BEC-PRIME\scripts'
$Watchdog='C:\BrownEyeCortex\scripts\Keep-DreamLedgerAwake.ps1'
$LogDir='D:\BrownEyeCortex\logs'
if(-not(Test-Path $LogDir)){New-Item -ItemType Directory -Path $LogDir -Force|Out-Null}
if(-not(Test-Path $Watchdog)){throw "Watchdog not found: $Watchdog"}
powercfg /change standby-timeout-ac 0 | Out-Null
powercfg /change hibernate-timeout-ac 0 | Out-Null
$action=New-ScheduledTaskAction -Execute 'powershell.exe' -Argument ('-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "{0}"' -f $Watchdog)
$trigger=New-ScheduledTaskTrigger -AtStartup
$principal=New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
Register-ScheduledTask -TaskName 'DreamLedger-AlwaysOn-Watchdog' -Action $action -Trigger $trigger -Principal $principal -Force | Out-Null
Add-Content -Path (Join-Path $LogDir 'dreamledger-watchdog.log') -Value ('[{0}] Watchdog installed.' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'))
Write-Host 'DreamLedger-AlwaysOn-Watchdog installed.'
Write-Host ('Verify: Get-ScheduledTask -TaskName DreamLedger-AlwaysOn-Watchdog | Format-List State,TaskName')
