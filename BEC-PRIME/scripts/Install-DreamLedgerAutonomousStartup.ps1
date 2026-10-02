#Requires -Version 5.1
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

<#
Installs the existing DreamLedger local runtime as a Windows logon task.
This uses Windows Task Scheduler only as the OS launch mechanism. It does
not create a DreamLedger scheduler, queue, ledger, or orchestration layer.
No secrets are written by this script.
#>

$ScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$Launcher = Join-Path $ScriptRoot 'Start-DreamLedgerAutonomous.ps1'
$TaskName = 'DreamLedger-Local-Autonomous-Runtime'

if (-not (Test-Path $Launcher)) {
    throw "LAUNCHER_NOT_FOUND:$Launcher"
}

$PowerShell = (Get-Command powershell.exe -ErrorAction Stop).Source
$Arguments = '-NoProfile -ExecutionPolicy Bypass -File "' + $Launcher + '"'

$Action = New-ScheduledTaskAction -Execute $PowerShell -Argument $Arguments
$Trigger = New-ScheduledTaskTrigger -AtLogOn -User ([System.Security.Principal.WindowsIdentity]::GetCurrent().Name)
$Principal = New-ScheduledTaskPrincipal -UserId ([System.Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType Interactive -RunLevel Limited
$Settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit ([TimeSpan]::Zero)

Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Principal $Principal -Settings $Settings -Force | Out-Null

Write-Host ('INSTALLED=' + $TaskName)
Write-Host ('LAUNCHER=' + $Launcher)
Write-Host 'TRIGGER=AT_LOGON'
Write-Host 'SECRETS_WRITTEN=NO'
Write-Host 'NEXT=Log off/on or start the scheduled task manually.'
