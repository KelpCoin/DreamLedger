[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$Root = 'D:\BrownEyeCortex\BEC-PRIME'
$Watcher = Join-Path $Root 'scripts\Watch-AutoCompile.ps1'
$TaskName = 'BEC-PRIME-AutoCompile-DreamLedger'

if (-not (Test-Path $Watcher)) { throw "Missing watcher: $Watcher" }

$Action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument ('-NoProfile -ExecutionPolicy Bypass -File "' + $Watcher + '"')
$Trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 5) -RepetitionDuration (New-TimeSpan -Days 3650)
$Principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited
$Settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew

Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Principal $Principal -Settings $Settings -Force | Out-Null
Write-Host ('INSTALLED: ' + $TaskName) -ForegroundColor Green
Write-Host 'Runs every 5 minutes and pushes generated compiler output only.'
Write-Host ('Log: ' + (Join-Path $Root 'WATCHDOG-LOGS\auto-compile.log'))
