#requires -Version 5.1
$ErrorActionPreference = "Stop"
$Runner = Join-Path $PSScriptRoot "LM-Studio-Swarm.ps1"
$TaskName = "DreamLedger-LMStudio-Economic-Swarm"
schtasks.exe /Create /TN $TaskName /SC ONLOGON /TR ('powershell.exe -NoProfile -ExecutionPolicy Bypass -File "' + $Runner + '"') /F | Out-Host
Write-Host "Installed $TaskName."
Write-Host "At logon: start LM Studio server, load a local model, then run the swarm continuously."
Write-Host "Irreversible external actions remain human-gated."
