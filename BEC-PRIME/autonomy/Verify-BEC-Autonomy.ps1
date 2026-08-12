#requires -Version 5.1
[CmdletBinding()]
param([string]$InstallRoot='D:\BrownEyeCortex\DreamLedgerAutonomy')
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$task=Get-ScheduledTask -TaskName 'BEC-DreamLedger-Autonomy' -ErrorAction SilentlyContinue
if(-not $task){throw 'FAIL: scheduled task missing'}
$cfg=Get-Content (Join-Path $InstallRoot 'config.json') -Raw | ConvertFrom-Json
if(-not $cfg.enabled){throw 'FAIL: autonomy disabled'}
try{$health=Invoke-RestMethod 'http://127.0.0.1:1234/v1/models' -TimeoutSec 5}catch{throw 'FAIL: LM Studio API unavailable at http://127.0.0.1:1234/v1'}
$proofs=Get-ChildItem (Join-Path $InstallRoot 'proofs') -Filter 'AUTONOMY_*.json' -ErrorAction SilentlyContinue
$queue=Get-ChildItem (Join-Path $InstallRoot 'queue') -Filter '*.json' -ErrorAction SilentlyContinue
Write-Host 'PASS: BEC autonomy verifier'
Write-Host "Task: $($task.State)"
Write-Host "LM Studio models: $(@($health.data).Count)"
Write-Host "Proof artifacts: $(@($proofs).Count)"
Write-Host "Action queue: $(@($queue).Count)"
Write-Host "Logs: $InstallRoot\logs\autonomy.log"
Write-Host "Proofs: $InstallRoot\proofs"
Write-Host "Queue: $InstallRoot\queue"
