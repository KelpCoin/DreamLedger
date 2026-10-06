#requires -Version 5.1
[CmdletBinding()]
param([switch]$Once,[int]$IntervalSeconds=300)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Continue"
$Root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$Run777 = Join-Path $Root "BEC-PRIME\scripts\Run-777.js"
$LmSwarm = Join-Path $Root "runtime\lm_studio\LM-Studio-Swarm.ps1"
$ProofDir = Join-Path $Root "runtime\777\supervisor-runs"
New-Item -ItemType Directory -Force -Path $ProofDir | Out-Null

function Invoke-Heartbeat {
  $started=(Get-Date).ToUniversalTime()
  $run777Status="NOT_RUN"
  $lmStatus="NOT_STARTED"

  if (Test-Path -LiteralPath $Run777) {
    try {
      & node $Run777 2>&1 | Out-File (Join-Path $ProofDir ("run777-"+$started.ToString("yyyyMMddTHHmmssZ")+".log")) -Encoding utf8
      $run777Status = if($LASTEXITCODE -eq 0){"PASS"}else{"FAIL:$LASTEXITCODE"}
    } catch { $run777Status="ERROR:$($_.Exception.Message)" }
  }

  if (Test-Path -LiteralPath $LmSwarm) {
    try {
      $existing=Get-Process powershell -ErrorAction SilentlyContinue | Where-Object { $_.Path -and $_.CommandLine -match "LM-Studio-Swarm.ps1" }
      if(-not $existing) {
        Start-Process powershell.exe -ArgumentList "-NoProfile","-ExecutionPolicy","Bypass","-File",$LmSwarm -WindowStyle Hidden | Out-Null
        $lmStatus="STARTED"
      } else { $lmStatus="ALREADY_RUNNING" }
    } catch { $lmStatus="ERROR:$($_.Exception.Message)" }
  }

  $proof=[ordered]@{
    schema="DREAMLEDGER/BEC-RUNTIME-HEARTBEAT/v1"
    started_at_utc=$started.ToString("o")
    completed_at_utc=(Get-Date).ToUniversalTime().ToString("o")
    run_777=$run777Status
    lm_studio=$lmStatus
    autonomous_internal_work=$true
    external_action_authorized_by_runtime=$false
    verified_external_revenue_nzd=0
    rule="internal heartbeat is not economic proof"
  }
  $proof | ConvertTo-Json -Depth 10 | Set-Content (Join-Path $ProofDir ("heartbeat-"+$started.ToString("yyyyMMddTHHmmssZ")+".json")) -Encoding utf8
}

do {
  Invoke-Heartbeat
  if($Once){break}
  Start-Sleep -Seconds $IntervalSeconds
} while($true)
