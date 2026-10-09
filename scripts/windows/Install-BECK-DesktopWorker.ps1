# Run from a checked-out DreamLedger repository in PowerShell. No admin rights or secrets required.
$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$worker = Join-Path $repoRoot "scripts\beck_desktop_worker.py"
if (-not (Test-Path $worker)) { throw "Worker not found: $worker" }
$python = (Get-Command python -ErrorAction Stop).Source
$taskName = "DreamLedger-BECK-Desktop-Worker"
$action = New-ScheduledTaskAction -Execute $python -Argument ('"' + $worker + '"') -WorkingDirectory $repoRoot
$trigger = New-ScheduledTaskTrigger -AtLogOn -User ($env:USERDOMAIN + "\" + $env:USERNAME)
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -MultipleInstances IgnoreNew
$principal = New-ScheduledTaskPrincipal -UserId ($env:USERDOMAIN + "\" + $env:USERNAME) -LogonType Interactive -RunLevel Limited
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Description "DreamLedger BECK local observer. No public publishing, spending, account changes, or external contact." -Force | Out-Null
Start-ScheduledTask -TaskName $taskName
Write-Output "REGISTERED_TASK=$taskName"
Write-Output "WORKER=$worker"
Write-Output "HEARTBEAT=$(Join-Path $repoRoot 'AGENT_BUS\BRIDGE\local_queue\beck-desktop-heartbeat.json')"
Write-Output "SAFETY=observer-only; LM Studio is optional; cloud remains authoritative"
