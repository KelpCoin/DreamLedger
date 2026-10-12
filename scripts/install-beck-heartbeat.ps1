#Requires -Version 5.1
[CmdletBinding()]
param([string]$RepoRoot = "")
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
if ([string]::IsNullOrWhiteSpace($RepoRoot)) { $RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path }
$RepoRoot = (Resolve-Path $RepoRoot).Path
$heartbeat = Join-Path $RepoRoot 'scripts\beck-heartbeat.ps1'
if (-not (Test-Path -LiteralPath $heartbeat)) { throw "Missing heartbeat script: $heartbeat" }
$proofRoot = if (Test-Path 'D:\') { 'D:\BrownEyeCortex\Runtime\proofs' } else { Join-Path $HOME 'BrownEyeCortex\Runtime\proofs' }
$null = New-Item -ItemType Directory -Force -Path $proofRoot
$taskName = 'DreamLedger-Local-Heartbeat'
$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument ('-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "' + $heartbeat + '" -RepoRoot "' + $RepoRoot + '" -ProofRoot "' + $proofRoot + '"')
$triggerBoot = New-ScheduledTaskTrigger -AtStartup
$triggerRepeat = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(2) -RepetitionInterval (New-TimeSpan -Minutes 15) -RepetitionDuration (New-TimeSpan -Days 3650)
$principal = New-ScheduledTaskPrincipal -UserId ([System.Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType Interactive -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Minutes 3) -MultipleInstances IgnoreNew
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger @($triggerBoot,$triggerRepeat) -Principal $principal -Settings $settings -Description 'Read-only local heartbeat. Cloud monitoring remains independent.' -Force | Out-Null
Write-Output "TASK_INSTALLED=$taskName"
Write-Output "TASK_SCHEDULE=at startup and every 15 minutes while the user session is available"
Write-Output "PROOF_ROOT=$proofRoot"
Write-Output "NOTE=Local diagnostics run under the interactive user; if logged off, cloud heartbeat continues independently."
