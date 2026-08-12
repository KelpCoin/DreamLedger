#requires -Version 5.1
[CmdletBinding()]
param([string]$InstallRoot='D:\BrownEyeCortex\DreamLedgerAutonomy')
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$RepoRoot = Split-Path -Parent $PSScriptRoot
$Source = Join-Path $PSScriptRoot 'AutonomyLoop.ps1'
$Config = Join-Path $PSScriptRoot 'config.json'
New-Item -ItemType Directory -Force -Path $InstallRoot,(Join-Path $InstallRoot 'logs'),(Join-Path $InstallRoot 'proofs'),(Join-Path $InstallRoot 'queue'),(Join-Path $InstallRoot 'state') | Out-Null
Copy-Item $Source (Join-Path $InstallRoot 'AutonomyLoop.ps1') -Force
Copy-Item $Config (Join-Path $InstallRoot 'config.json') -Force
$taskName='BEC-DreamLedger-Autonomy'
$run = "powershell.exe -NoProfile -ExecutionPolicy Bypass -File `"$InstallRoot\AutonomyLoop.ps1`""
$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$InstallRoot\AutonomyLoop.ps1`""
$trigger = New-ScheduledTaskTrigger -AtStartup
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType InteractiveToken -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 2) -ExecutionTimeLimit (New-TimeSpan -Days 3650)
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force | Out-Null
Start-ScheduledTask -TaskName $taskName
$proof=[ordered]@{schema='BEC-AUTONOMY-INSTALL-PROOF-1';installed_utc=(Get-Date).ToUniversalTime().ToString('o');task=$taskName;install_root=$InstallRoot;repo_root=$RepoRoot;lm_studio='http://127.0.0.1:1234/v1';policy='external publication approval-gated; settlement buyer-authorized'}
$proof | ConvertTo-Json -Depth 10 | Set-Content (Join-Path $InstallRoot 'proofs\INSTALL_PROOF.json') -Encoding UTF8
Write-Host 'PASS: BEC autonomy installed and scheduled.'
Write-Host "Proof: $InstallRoot\proofs\INSTALL_PROOF.json"
Write-Host "Verify: powershell -NoProfile -ExecutionPolicy Bypass -File `"$RepoRoot\BEC-PRIME\autonomy\Verify-BEC-Autonomy.ps1`""
